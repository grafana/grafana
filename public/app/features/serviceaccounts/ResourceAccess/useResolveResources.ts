import { useEffect, useMemo, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';

import { type ParsedResource, type ResourceType } from './useResourcePermissions';

export interface ResolvedResource {
  /** The original parsed permission entry */
  permission: ParsedResource;
  /** Resolved display name */
  name: string;
  /** URL to navigate to this resource (if available) */
  url?: string;
  /** For folder-scoped dashboard access, the resolved folder name */
  folderName?: string;
}

interface DashboardSearchHit {
  uid: string;
  title: string;
  url: string;
  type: string;
  folderUid?: string;
  folderTitle?: string;
}

interface FolderDTO {
  uid: string;
  title: string;
  url?: string;
}

interface DataSourceDTO {
  uid: string;
  name: string;
  type: string;
}

export interface ResolveResult {
  resolved: ResolvedResource[];
  isResolving: boolean;
}

/** Well-known virtual UIDs that need special handling */
const BUILTIN_NAMES: Record<string, string> = {
  general: 'General',
  grafana: 'Grafana (built-in)',
};

/**
 * Resolve parsed permission scopes into named resources.
 *
 * Takes the output of useResourcePermissions and batch-resolves UIDs
 * to display names via existing Grafana APIs.
 *
 * Skips resolution for wildcard entries (they show "All X" in the UI).
 */
export function useResolveResources(
  resources: ParsedResource[],
  isPermissionsLoading: boolean
): ResolveResult {
  const [resolved, setResolved] = useState<ResolvedResource[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  // Separate resources by type and collect UIDs to resolve
  const toResolve = useMemo(() => {
    if (isPermissionsLoading) {
      return null;
    }

    const dashboardUids = new Set<string>();
    const folderUids = new Set<string>();
    const datasourceUids = new Set<string>();

    for (const r of resources) {
      if (r.isWildcard) {
        continue; // Don't enumerate wildcards
      }

      if (r.type === 'dashboards') {
        if (r.uid) {
          dashboardUids.add(r.uid);
        }
        if (r.folderUid) {
          folderUids.add(r.folderUid);
        }
      } else if (r.type === 'folders') {
        if (r.uid) {
          folderUids.add(r.uid);
        }
      } else if (r.type === 'datasources') {
        if (r.uid) {
          datasourceUids.add(r.uid);
        }
      }
    }

    return { dashboardUids, folderUids, datasourceUids };
  }, [resources, isPermissionsLoading]);

  useEffect(() => {
    if (!toResolve) {
      return;
    }

    const { dashboardUids, folderUids, datasourceUids } = toResolve;

    // Nothing to resolve — just pass through wildcards
    if (dashboardUids.size === 0 && folderUids.size === 0 && datasourceUids.size === 0) {
      setResolved(
        resources.map((r) => ({
          permission: r,
          name: r.isWildcard ? `All ${r.type}` : r.uid || 'Unknown',
        }))
      );
      return;
    }

    setIsResolving(true);

    const resolve = async () => {
      const nameMap = new Map<string, { name: string; url?: string }>();

      // Add built-in names
      for (const [uid, name] of Object.entries(BUILTIN_NAMES)) {
        nameMap.set(uid, { name });
      }

      // Resolve in parallel
      const promises: Promise<void>[] = [];

      // Dashboards: batch via /api/search
      if (dashboardUids.size > 0) {
        promises.push(
          getBackendSrv()
            .get<DashboardSearchHit[]>('/api/search', {
              dashboardUIDs: Array.from(dashboardUids),
              limit: 500,
            })
            .then((hits) => {
              for (const hit of hits) {
                nameMap.set(hit.uid, { name: hit.title, url: hit.url });
              }
            })
            .catch(() => {
              // Silently fail — UIDs will show as raw values
            })
        );
      }

      // Folders: fetch all (usually small list)
      if (folderUids.size > 0) {
        promises.push(
          getBackendSrv()
            .get<FolderDTO[]>('/api/folders', { limit: 1000 })
            .then((folders) => {
              for (const folder of folders) {
                nameMap.set(folder.uid, {
                  name: folder.title,
                  url: `/dashboards/f/${folder.uid}`,
                });
              }
            })
            .catch(() => {})
        );
      }

      // Datasources: fetch all (usually small list)
      if (datasourceUids.size > 0) {
        promises.push(
          getBackendSrv()
            .get<DataSourceDTO[]>('/api/datasources')
            .then((dataSources) => {
              for (const ds of dataSources) {
                nameMap.set(ds.uid, {
                  name: ds.name,
                  url: `/datasources/edit/${ds.uid}`,
                });
              }
            })
            .catch(() => {})
        );
      }

      await Promise.all(promises);

      // Map resources to resolved entries
      const results: ResolvedResource[] = resources.map((r) => {
        if (r.isWildcard) {
          return { permission: r, name: `All ${r.type}` };
        }

        // Folder-scoped dashboard access
        if (r.folderUid) {
          const folder = nameMap.get(r.folderUid);
          const folderName = folder?.name || r.folderUid;
          return {
            permission: r,
            name: `All dashboards in "${folderName}"`,
            folderName,
            url: folder?.url,
          };
        }

        const uid = r.uid || '';
        const entry = nameMap.get(uid);
        return {
          permission: r,
          name: entry?.name || uid,
          url: entry?.url,
        };
      });

      setResolved(results);
      setIsResolving(false);
    };

    resolve();
  }, [toResolve, resources]);

  return { resolved, isResolving };
}

/**
 * Count total resources by type. For wildcards, fetch the actual count from the API.
 */
export function useResourceCounts(
  wildcardTypes: Set<ResourceType>
): Record<ResourceType, number | null> {
  const [counts, setCounts] = useState<Record<ResourceType, number | null>>({
    dashboards: null,
    folders: null,
    datasources: null,
  });

  useEffect(() => {
    const fetchCounts = async () => {
      const newCounts = { ...counts };

      const promises: Promise<void>[] = [];

      if (wildcardTypes.has('dashboards')) {
        promises.push(
          getBackendSrv()
            .get<DashboardSearchHit[]>('/api/search', { type: 'dash-db', limit: 1 })
            .then(() => {
              // The search API doesn't return total count easily,
              // so we do a count query
              return getBackendSrv().get<DashboardSearchHit[]>('/api/search', {
                type: 'dash-db',
                limit: 5000,
              });
            })
            .then((hits) => {
              newCounts.dashboards = hits.length;
            })
            .catch(() => {})
        );
      }

      if (wildcardTypes.has('folders')) {
        promises.push(
          getBackendSrv()
            .get<FolderDTO[]>('/api/folders', { limit: 1000 })
            .then((folders) => {
              newCounts.folders = folders.length;
            })
            .catch(() => {})
        );
      }

      if (wildcardTypes.has('datasources')) {
        promises.push(
          getBackendSrv()
            .get<DataSourceDTO[]>('/api/datasources')
            .then((ds) => {
              newCounts.datasources = ds.length;
            })
            .catch(() => {})
        );
      }

      await Promise.all(promises);
      setCounts(newCounts);
    };

    if (wildcardTypes.size > 0) {
      fetchCounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wildcardTypes]);

  return counts;
}

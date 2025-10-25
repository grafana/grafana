import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import {
  GetRepositoryFilesApiResponse,
  GetResourceStatsApiResponse,
  ManagerStats,
  RepositoryView,
  ResourceCount,
  useGetRepositoryFilesQuery,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

function getManagedCount(managed?: ManagerStats[]) {
  let totalCount = 0;

  // Loop through each managed repository
  managed?.forEach((manager) => {
    if (manager.kind === ManagerKind.Repo) {
      // Loop through stats inside each manager and sum up the counts
      manager.stats.forEach((stat) => {
        if (stat.group === 'folder.grafana.app' || stat.group === 'dashboard.grafana.app') {
          totalCount += stat.count;
        }
      });
    }
  });

  return totalCount;
}

function getResourceCount(stats?: ResourceCount[], managed?: ManagerStats[]) {
  let counts: string[] = [];
  let resourceCount = 0;

  stats?.forEach((stat) => {
    switch (stat.group) {
      case 'folders':
      case 'folder.grafana.app':
        resourceCount += stat.count;
        counts.push(t('provisioning.bootstrap-step.folders-count', '{{count}} folder', { count: stat.count }));
        break;
      case 'dashboard.grafana.app':
        resourceCount += stat.count;
        counts.push(t('provisioning.bootstrap-step.dashboards-count', '{{count}} dashboard', { count: stat.count }));
        break;
    }
  });

  managed?.forEach((manager) => {
    if (manager.kind !== ManagerKind.Repo) {
      manager.stats.forEach((stat) => {
        switch (stat.group) {
          case 'folders':
          case 'folder.grafana.app':
            resourceCount += stat.count;
            counts.push(t('provisioning.bootstrap-step.folders-count', '{{count}} folder', { count: stat.count }));
            break;
          case 'dashboard.grafana.app':
            resourceCount += stat.count;
            counts.push(
              t('provisioning.bootstrap-step.dashboards-count', '{{count}} dashboard', { count: stat.count })
            );
            break;
        }
      });
    }
  });

  return {
    counts,
    resourceCount,
  };
}

/**
 * Calculates resource statistics from API responses
 */
function getResourceStats(files?: GetRepositoryFilesApiResponse, stats?: GetResourceStatsApiResponse) {
  const isSupportedFile = (path: string) => path.endsWith('.json') || path.endsWith('.yaml');

  const items = files?.items ?? [];

  const fileCount = items.filter((file) => {
    const path = file.path ?? '';
    return isSupportedFile(path);
  }).length;

  const { counts, resourceCount } = getResourceCount(stats?.instance);

  return {
    fileCount,
    resourceCount,
    resourceCountString: counts.join(',\n'),
  };
}

/**
 * Hook that provides resource statistics and sync logic
 */
export function useResourceStats(repoName?: string, isLegacyStorage?: boolean, syncTarget?: RepositoryView['target']) {
  const resourceStatsQuery = useGetResourceStatsQuery(repoName ? undefined : skipToken);
  const filesQuery = useGetRepositoryFilesQuery(repoName ? { name: repoName } : skipToken);

  const isLoading = resourceStatsQuery.isLoading || filesQuery.isLoading;

  const { resourceCount, resourceCountString, fileCount } = useMemo(
    () => getResourceStats(filesQuery.data, resourceStatsQuery.data),
    [filesQuery.data, resourceStatsQuery.data]
  );

  const { managedCount, unmanagedCount } = useMemo(() => {
    return {
      // managed does not exist in response when first time connecting to a repo
      managedCount: getManagedCount(resourceStatsQuery.data?.managed),
      // "unmanaged" means unmanaged by git sync. it may still be managed by other means, like terraform, plugins, file provisioning, etc.
      unmanagedCount: getResourceCount(resourceStatsQuery.data?.unmanaged, resourceStatsQuery.data?.managed)
        .resourceCount,
    };
  }, [resourceStatsQuery.data]);

  const requiresMigration = isLegacyStorage || syncTarget === 'instance';
  const shouldSkipSync = !isLegacyStorage && (resourceCount === 0 || syncTarget === 'folder') && fileCount === 0;

  // Format display strings
  const resourceCountDisplay =
    resourceCount > 0 ? resourceCountString : t('provisioning.bootstrap-step.empty', 'Empty');
  const fileCountDisplay =
    fileCount > 0
      ? t('provisioning.bootstrap-step.files-count', '{{count}} files', { count: fileCount })
      : t('provisioning.bootstrap-step.empty', 'Empty');

  return {
    managedCount,
    unmanagedCount,
    resourceCount,
    resourceCountString: resourceCountDisplay,
    fileCount,
    fileCountString: fileCountDisplay,
    isLoading,
    requiresMigration,
    shouldSkipSync,
  };
}

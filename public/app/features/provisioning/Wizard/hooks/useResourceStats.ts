import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import {
  type GetRepositoryFilesApiResponse,
  type GetResourceStatsApiResponse,
  type ManagerStats,
  type RepositoryView,
  type ResourceCount,
  useGetRepositoryFilesQuery,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

import { getKindInfoByStatGroup } from '../../utils/resourceKinds';

export type UseResourceStatsOptions = {
  isHealthy?: boolean; // true only when healthy AND reconciled
  healthStatusNotReady?: boolean; // true when waiting for reconciliation
};

function getManagedCount(managed?: ManagerStats[]) {
  let totalCount = 0;

  // Loop through each managed repository
  managed?.forEach((manager) => {
    if (manager.kind === ManagerKind.Repo) {
      // Loop through stats inside each manager and sum up the counts for known kinds
      manager.stats.forEach((stat) => {
        if (getKindInfoByStatGroup(stat.group)) {
          totalCount += stat.count;
        }
      });
    }
  });

  return totalCount;
}

function getResourceCount(stats?: ResourceCount[], managed?: ManagerStats[]) {
  let resourceCount = 0;

  const addStat = (stat: ResourceCount) => {
    // Only count kinds the UI knows about (folders, dashboards, ...).
    if (getKindInfoByStatGroup(stat.group)) {
      resourceCount += stat.count;
    }
  };

  stats?.forEach(addStat);

  managed?.forEach((manager) => {
    if (manager.kind !== ManagerKind.Repo) {
      manager.stats.forEach(addStat);
    }
  });

  return resourceCount;
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

  const resourceCount = getResourceCount(stats?.instance);

  return {
    fileCount,
    resourceCount,
  };
}

/**
 * Hook that provides resource statistics and sync logic
 */

// TODO: update params to be object
export function useResourceStats(
  repoName?: string,
  syncTarget?: RepositoryView['target'],
  migrateResources?: boolean,
  options?: UseResourceStatsOptions
) {
  const { isHealthy, healthStatusNotReady } = options || {};

  const resourceStatsQuery = useGetResourceStatsQuery(repoName ? undefined : skipToken);
  // isHealthy already includes reconciliation check - safe to fetch files
  const filesQuery = useGetRepositoryFilesQuery(repoName && isHealthy ? { name: repoName } : skipToken, {
    refetchOnMountOrArgChange: true,
  });

  const isLoading = resourceStatsQuery.isFetching || filesQuery.isFetching || Boolean(healthStatusNotReady);

  const { resourceCount, fileCount } = useMemo(
    () => getResourceStats(filesQuery.data, resourceStatsQuery.data),
    [filesQuery.data, resourceStatsQuery.data]
  );

  const { managedCount, unmanagedCount } = useMemo(() => {
    return {
      // managed does not exist in response when first time connecting to a repo
      managedCount: getManagedCount(resourceStatsQuery.data?.managed),
      // "unmanaged" means unmanaged by git sync. it may still be managed by other means, like terraform, plugins, file provisioning, etc.
      unmanagedCount: getResourceCount(resourceStatsQuery.data?.unmanaged, resourceStatsQuery.data?.managed),
    };
  }, [resourceStatsQuery.data]);

  // Calculate requiresMigration based on sync target and user selection
  // For instance sync: migrate if there are resources (checkbox is disabled and always true)
  // For folder and folderless sync: only migrate if user explicitly opts in via checkbox
  const requiresMigration = syncTarget === 'instance' ? resourceCount > 0 : (migrateResources ?? false);
  const shouldSkipSync =
    (resourceCount === 0 || syncTarget === 'folder' || syncTarget === 'folderless') && fileCount === 0;

  // Format display strings
  const resourceCountDisplay =
    resourceCount > 0
      ? t('provisioning.bootstrap-step.resources-count', '', {
          count: resourceCount,
          defaultValue_one: '{{count}} resource',
          defaultValue_other: '{{count}} resources',
        })
      : t('provisioning.bootstrap-step.empty', 'Empty');
  const fileCountDisplay =
    fileCount > 0
      ? t('provisioning.bootstrap-step.files-count', '', {
          count: fileCount,
          defaultValue_one: '{{count}} file',
          defaultValue_other: '{{count}} files',
        })
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

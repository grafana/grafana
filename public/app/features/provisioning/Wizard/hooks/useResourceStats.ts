import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import {
  GetRepositoryFilesApiResponse,
  GetResourceStatsApiResponse,
  useGetRepositoryFilesQuery,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';

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

  let counts: string[] = [];
  let resourceCount = 0;

  stats?.instance?.forEach((stat) => {
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

  return {
    fileCount,
    resourceCount,
    resourceCountString: counts.join(',\n'),
  };
}

/**
 * Hook that provides resource statistics and sync logic
 */
export function useResourceStats(repoName?: string, isLegacyStorage?: boolean) {
  const resourceStatsQuery = useGetResourceStatsQuery(repoName ? undefined : skipToken);
  const filesQuery = useGetRepositoryFilesQuery(repoName ? { name: repoName } : skipToken);

  const isLoading = resourceStatsQuery.isLoading || filesQuery.isLoading;

  const { resourceCount, resourceCountString, fileCount } = useMemo(
    () => getResourceStats(filesQuery.data, resourceStatsQuery.data),
    [filesQuery.data, resourceStatsQuery.data]
  );

  const requiresMigration = isLegacyStorage || resourceCount > 0;
  const shouldSkipSync = !requiresMigration && resourceCount === 0 && fileCount === 0;

  // Format display strings
  const resourceCountDisplay =
    resourceCount > 0 ? resourceCountString : t('provisioning.bootstrap-step.empty', 'Empty');
  const fileCountDisplay =
    fileCount > 0
      ? t('provisioning.bootstrap-step.files-count', '{{count}} files', { count: fileCount })
      : t('provisioning.bootstrap-step.empty', 'Empty');

  return {
    resourceCount,
    resourceCountString: resourceCountDisplay,
    fileCount,
    fileCountString: fileCountDisplay,
    isLoading,
    requiresMigration,
    shouldSkipSync,
  };
}

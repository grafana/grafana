import { getTemplateSrv } from '@grafana/runtime';

import { type AzureMonitorQuery } from '../../types/query';
import { parseResourceURI } from '../ResourcePicker/utils';

export type SelectedLogTier = 'Analytics' | 'Basic' | 'Auxiliary';
export type LogTier = 'Basic' | 'Auxiliary';

export function shouldShowBasicLogsToggle(resources: string[], basicLogsEnabled: boolean) {
  const searchLogsEnabled = basicLogsEnabled;
  const selectedResource = getTemplateSrv()?.replace(resources[0]);
  return (
    searchLogsEnabled &&
    resources.length === 1 &&
    parseResourceURI(selectedResource).metricNamespace?.toLowerCase() === 'microsoft.operationalinsights/workspaces'
  );
}

// Derives the currently-selected Logs tier from the query.
// `basicLogsQuery: true` with no `logTier` is a legacy state from before Auxiliary support and is treated as Basic.
export function getSelectedLogTier(query: AzureMonitorQuery): SelectedLogTier {
  if (!query.azureLogAnalytics?.basicLogsQuery) {
    return 'Analytics';
  }
  return query.azureLogAnalytics.logTier ?? 'Basic';
}

export function calculateTimeRange(from: number, to: number): number {
  const second = 1000;
  const minute = second * 60;
  const hour = minute * 60;
  const day = hour * 24;
  const timeRange = (to - from) / day;

  return timeRange;
}

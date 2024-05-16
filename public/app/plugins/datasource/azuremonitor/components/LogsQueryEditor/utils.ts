import { getTemplateSrv } from '@grafana/runtime';

import { parseResourceURI } from '../ResourcePicker/utils';

export const MAX_DATA_RETENTION_DAYS = 8; // limit is only for basic logs
export function shouldShowBasicLogsToggle(resources: string[], basicLogsEnabled: boolean) {
  const selectedResource = getTemplateSrv().replace(resources[0]);
  return (
    basicLogsEnabled &&
    resources.length === 1 &&
    parseResourceURI(selectedResource).metricNamespace?.toLowerCase() === 'microsoft.operationalinsights/workspaces'
  );
}

export function calculateTimeRange(from: number, to: number): number {
  const second = 1000;
  const minute = second * 60;
  const hour = minute * 60;
  const day = hour * 24;
  const timeRange = (to - from) / day;

  return timeRange;
}

// Ensure the timerange is always at most 8 days
// used for basic logs since data retention is max 8 days and usage should be calculated accordingly
export function checkTime(from: number, to: number): string {
  const second = 1000;
  const minute = second * 60;
  const hour = minute * 60;
  const day = hour * 24;

  const timeRange = calculateTimeRange(from, to);
  const truncatedToTime = from + MAX_DATA_RETENTION_DAYS * day;

  return timeRange > MAX_DATA_RETENTION_DAYS ? truncatedToTime.toString() : to.toString();
}

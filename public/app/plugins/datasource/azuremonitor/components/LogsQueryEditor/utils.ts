import { parseResourceURI } from '../ResourcePicker/utils';

export function shouldShowBasicLogsToggle(resources: string[], basicLogsEnabled: boolean) {
  return (
    basicLogsEnabled &&
    resources.length === 1 &&
    parseResourceURI(resources[0]).metricNamespace?.toLowerCase() === 'microsoft.operationalinsights/workspaces'
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

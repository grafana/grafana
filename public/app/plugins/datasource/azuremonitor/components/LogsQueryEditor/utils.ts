import { parseResourceURI } from '../ResourcePicker/utils';

export function shouldShowBasicLogsToggle(resources: string[], basicLogsEnabled: boolean) {
  return (
    basicLogsEnabled &&
    resources.length === 1 &&
    parseResourceURI(resources[0]).metricNamespace?.toLowerCase() === 'microsoft.operationalinsights/workspaces'
  );
}

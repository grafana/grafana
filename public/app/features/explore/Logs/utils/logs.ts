import { shallowCompare } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export const SETTINGS_KEYS = {
  showLabels: 'grafana.explore.logs.showLabels',
  showTime: 'grafana.explore.logs.showTime',
  wrapLogMessage: 'grafana.explore.logs.wrapLogMessage',
  prettifyLogMessage: 'grafana.explore.logs.prettifyLogMessage',
  logsSortOrder: 'grafana.explore.logs.sortOrder',
  logContextWrapLogMessage: 'grafana.explore.logs.logContext.wrapLogMessage',
};

export const visualisationTypeKey = 'grafana.explore.logs.visualisationType';

export const canKeepDisplayedFields = (logsQueries: DataQuery[] | undefined, prevLogsQueries: DataQuery[]): boolean => {
  if (!logsQueries) {
    return false;
  }
  for (let i = 0; i < logsQueries.length; i++) {
    if (!logsQueries[i] || !prevLogsQueries[i] || !shallowCompare(logsQueries[i], prevLogsQueries[i])) {
      return false;
    }
  }
  return true;
};

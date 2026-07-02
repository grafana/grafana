export const SETTINGS_KEYS = {
  showLabels: 'grafana.explore.logs.showLabels',
  showTime: 'grafana.explore.logs.showTime',
  wrapLogMessage: 'grafana.explore.logs.wrapLogMessage',
  prettifyLogMessage: 'grafana.explore.logs.prettifyLogMessage',
  logsSortOrder: 'grafana.explore.logs.sortOrder',
  logContextWrapLogMessage: 'grafana.explore.logs.logContext.wrapLogMessage',
  commonLabels: 'grafana.explore.logs.commonLabels',
};

export const LOGS_TABLE_SETTING_KEYS = {
  sortBy: 'grafana.explore.logs.table.sortBy',
  fieldSelectorWidth: 'grafana.explore.logs.table.fieldSelectorWidth',
};

export const SETTING_KEY_ROOT = 'grafana.explore.logs';

export const visualisationTypeKey = 'grafana.explore.logs.visualisationType';

export const getLogsTableHeight = () => {
  // Instead of making the height of the table based on the content (like in the table panel itself), let's try to use the vertical space that is available.
  // Since this table is in explore, we can expect the user to be running multiple queries that return disparate numbers of rows and labels in the same session
  // Also changing the height of the table between queries can be and cause content to jump, so we'll set a minimum height of 500px, and a max based on the innerHeight
  // Ideally the table container should always be able to fit in the users viewport without needing to scroll
  return Math.max(window.innerHeight - 500, 500);
};

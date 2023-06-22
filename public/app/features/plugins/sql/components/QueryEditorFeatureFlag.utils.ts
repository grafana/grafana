import { config } from '@grafana/runtime';

export const isSqlDatasourceDatabaseSelectionFeatureFlagEnabled = () => {
  return !!config.featureToggles.sqlDatasourceDatabaseSelection;
};

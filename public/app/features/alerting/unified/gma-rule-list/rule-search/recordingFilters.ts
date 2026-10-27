import { t } from '@grafana/i18n';

import { type FilterDefinition, sharedFilters } from './filterDefinitions';

export const recordingFilters: Array<FilterDefinition<'recording'>> = [
  sharedFilters.rule,
  sharedFilters.label,
  sharedFilters.folder,
  sharedFilters.datasource,
  sharedFilters.plugins,
  {
    key: 'metric',
    label: () => t('alerting.gma-rule-list.search.property.metric', 'Recorded metric'),
    description: () => t('alerting.gma-rule-list.search.help.metric', 'Recorded metric name (exact match).'),
    example: 'metric:cpu_usage',
  },
  {
    key: 'targetDatasource',
    label: () => t('alerting.gma-rule-list.search.property.target-datasource', 'Target data source'),
    description: () =>
      t(
        'alerting.gma-rule-list.search.help.target-datasource',
        'Data source the recorded metric is written to (canonical value is the UID).'
      ),
    example: 'targetDatasource:ds-uid',
  },
  sharedFilters.health,
];

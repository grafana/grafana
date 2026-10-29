import { t } from '@grafana/i18n';

import { TOKEN_KEYS, type TokenDefinition, sharedDefinitions } from './tokens';

export const recordingTokens: TokenDefinition[] = [
  sharedDefinitions.rule,
  sharedDefinitions.label,
  sharedDefinitions.namespace,
  sharedDefinitions.datasource,
  sharedDefinitions.plugins,
  {
    key: TOKEN_KEYS.metric,
    label: () => t('alerting.gma-rule-list.token-search.property.metric', 'Recorded metric'),
    description: () => t('alerting.gma-rule-list.token-search.help.metric', 'Recorded metric name (exact match).'),
    example: 'metric:cpu_usage',
  },
  {
    key: TOKEN_KEYS.targetDatasource,
    label: () => t('alerting.gma-rule-list.token-search.property.target-datasource', 'Target data source'),
    description: () =>
      t(
        'alerting.gma-rule-list.token-search.help.target-datasource',
        'Data source the recorded metric is written to (canonical value is the UID).'
      ),
    example: 'targetDatasource:ds-uid',
  },
  sharedDefinitions.health,
];

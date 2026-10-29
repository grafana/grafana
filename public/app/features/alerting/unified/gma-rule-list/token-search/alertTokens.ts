import { t } from '@grafana/i18n';

import { DEFAULT_POLICY } from './ruleSearchFilter';
import { TOKEN_KEYS, type TokenDefinition, sharedDefinitions } from './tokens';

export const alertTokens: TokenDefinition[] = [
  sharedDefinitions.rule,
  sharedDefinitions.label,
  sharedDefinitions.namespace,
  sharedDefinitions.datasource,
  sharedDefinitions.plugins,
  {
    key: TOKEN_KEYS.dashboard,
    label: () => t('alerting.gma-rule-list.token-search.property.dashboard', 'Dashboard'),
    description: () =>
      t(
        'alerting.gma-rule-list.token-search.help.dashboard',
        'Dashboard the rule is linked to (canonical value is the dashboard UID).'
      ),
    example: 'dashboard:dash-uid',
  },
  {
    key: TOKEN_KEYS.panelId,
    label: () => t('alerting.gma-rule-list.token-search.property.panel', 'Panel ID'),
    description: () =>
      t(
        'alerting.gma-rule-list.token-search.help.panel-id',
        'Panel the rule is linked to. Panel IDs are dashboard-local; pair with dashboard:.'
      ),
    example: 'panelId:4',
  },
  {
    key: TOKEN_KEYS.contactPoint,
    label: () => t('alerting.gma-rule-list.token-search.property.contact-point', 'Contact point'),
    description: () =>
      t('alerting.gma-rule-list.token-search.help.contact-point', 'Direct contact point (mutually exclusive with policy:).'),
    example: 'contactPoint:on-call',
  },
  {
    key: TOKEN_KEYS.policy,
    label: () => t('alerting.gma-rule-list.token-search.property.policy', 'Notification policy'),
    description: () =>
      t(
        'alerting.gma-rule-list.token-search.help.policy',
        'Named notification policy (mutually exclusive with contactPoint:).'
      ),
    example: 'policy:team-platform',
    unavailableValues: [
      {
        value: DEFAULT_POLICY,
        reason: () =>
          t(
            'alerting.gma-rule-list.token-search.default-policy-unavailable',
            "Filtering by the default policy isn't available yet."
          ),
      },
    ],
  },
  {
    key: TOKEN_KEYS.paused,
    label: () => t('alerting.gma-rule-list.token-search.property.paused', 'Paused'),
    description: () => t('alerting.gma-rule-list.token-search.help.paused', 'Whether the rule is paused (true/false).'),
    example: 'paused:true',
  },
  {
    key: TOKEN_KEYS.state,
    label: () => t('alerting.gma-rule-list.token-search.property.state', 'Alert state'),
    description: () =>
      t('alerting.gma-rule-list.token-search.help.state', 'Alert state: firing, pending, recovering or normal.'),
    example: 'state:firing',
  },
  sharedDefinitions.health,
];

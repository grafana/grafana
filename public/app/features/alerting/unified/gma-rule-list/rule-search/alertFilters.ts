import { t } from '@grafana/i18n';

import { type FilterDefinition, sharedFilters } from './filterDefinitions';
import { DEFAULT_POLICY, STATE_API_VALUES } from './ruleSearchFilter';

export const alertFilters: Array<FilterDefinition<'alert'>> = [
  sharedFilters.rule,
  sharedFilters.label,
  sharedFilters.folder,
  sharedFilters.datasource,
  sharedFilters.plugins,
  {
    key: 'dashboard',
    label: () => t('alerting.gma-rule-list.search.property.dashboard', 'Dashboard'),
    description: () =>
      t(
        'alerting.gma-rule-list.search.help.dashboard',
        'Dashboard the rule is linked to (canonical value is the dashboard UID).'
      ),
    example: 'dashboard:dash-uid',
  },
  {
    key: 'panelId',
    label: () => t('alerting.gma-rule-list.search.property.panel', 'Panel ID'),
    description: () =>
      t(
        'alerting.gma-rule-list.search.help.panel-id',
        'Panel the rule is linked to. Panel IDs are dashboard-local; pair with dashboard:.'
      ),
    example: 'panelId:4',
  },
  {
    key: 'contactPoint',
    label: () => t('alerting.gma-rule-list.search.property.contact-point', 'Contact point'),
    description: () =>
      t('alerting.gma-rule-list.search.help.contact-point', 'Direct contact point (mutually exclusive with policy:).'),
    example: 'contactPoint:on-call',
  },
  {
    key: 'policy',
    label: () => t('alerting.gma-rule-list.search.property.policy', 'Notification policy'),
    description: () =>
      t(
        'alerting.gma-rule-list.search.help.policy',
        'Named notification policy (mutually exclusive with contactPoint:).'
      ),
    example: 'policy:team-platform',
    unavailableValues: [
      {
        value: DEFAULT_POLICY,
        reason: () =>
          t(
            'alerting.gma-rule-list.search.default-policy-unavailable',
            "Filtering by the default policy isn't available yet."
          ),
      },
    ],
  },
  {
    key: 'paused',
    label: () => t('alerting.gma-rule-list.search.property.paused', 'Paused'),
    description: () => t('alerting.gma-rule-list.search.help.paused', 'Whether the rule is paused (true/false).'),
    example: 'paused:true',
    values: ['true', 'false'],
    unavailableValues: [
      {
        value: 'false',
        reason: () =>
          t('alerting.gma-rule-list.search.not-paused-unavailable', "Filtering by not paused isn't available yet."),
      },
    ],
  },
  {
    key: 'state',
    label: () => t('alerting.gma-rule-list.search.property.state', 'Alert state'),
    description: () =>
      t('alerting.gma-rule-list.search.help.state', 'Alert state: firing, pending, recovering or normal.'),
    example: 'state:firing',
    values: Object.keys(STATE_API_VALUES),
  },
  sharedFilters.health,
];

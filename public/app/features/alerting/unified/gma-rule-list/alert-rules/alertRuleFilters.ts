import { isDefaultRoutingTreeName } from '@grafana/alerting/unstable';
import { type AlertRuleAlertRuleState } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';

import { type RuleSearchSchema } from '../rule-search/filterDefinitions';
import { type SharedFilterKey, hasWildcard, sharedFilters } from '../rule-search/sharedFilters';
import { type SharedRuleFilter, createEmptyFilter } from '../rule-search/sharedRuleFilter';

export interface AlertRuleFilter extends SharedRuleFilter {
  dashboardUid?: string;
  panelId?: string;
  contactPoint?: string;
  /** Named routing tree, or `DEFAULT_POLICY` for the default-policy filter (not searchable yet). */
  policy?: string;
  paused?: 'true' | 'false';
  state?: StateValue;
}

export type AlertFilterKey = SharedFilterKey | 'state' | 'dashboard' | 'panelId' | 'contactPoint' | 'policy' | 'paused';

/** Reserved `policy` value that stands for "rules using the default notification policy". */
export const DEFAULT_POLICY = 'default';

/** Each `state:` value and the API states it matches. */
export const STATE_API_VALUES = {
  firing: ['Firing'],
  pending: ['Pending'],
  recovering: ['Recovering'],
  // Neither has a firing, pending or recovering instance.
  normal: ['Healthy', 'Inactive'],
} satisfies Record<string, AlertRuleAlertRuleState[]>;

type StateValue = keyof typeof STATE_API_VALUES;

export const alertRuleSearchSchema: RuleSearchSchema<AlertRuleFilter, AlertFilterKey> = {
  createEmptyFilter,
  filters: [
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
      apply: (filter, value) => {
        filter.dashboardUid = value;
        return true;
      },
      feedback: (filter) => (filter.dashboardUid && hasWildcard(filter.dashboardUid) ? 'invalid' : undefined),
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
      apply: (filter, value) => {
        filter.panelId = value;
        return true;
      },
      feedback: (filter) =>
        filter.panelId && (!filter.dashboardUid || !isPositiveInteger(filter.panelId)) ? 'invalid' : undefined,
    },
    {
      key: 'contactPoint',
      label: () => t('alerting.gma-rule-list.search.property.contact-point', 'Contact point'),
      description: () =>
        t(
          'alerting.gma-rule-list.search.help.contact-point',
          'Direct contact point (mutually exclusive with policy:).'
        ),
      example: 'contactPoint:on-call',
      apply: (filter, value) => {
        filter.contactPoint = value;
        return true;
      },
      // A rule routes either through a policy or straight to a contact point, so the two never match together.
      feedback: (filter) =>
        filter.contactPoint && (filter.policy || hasWildcard(filter.contactPoint)) ? 'invalid' : undefined,
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
      apply: (filter, value) => {
        // The default tree's emitted name (`user-defined`) means the default policy, which no named-tree filter matches.
        filter.policy = isDefaultRoutingTreeName(value) ? DEFAULT_POLICY : value;
        return true;
      },
      feedback: (filter) => {
        if (filter.policy === DEFAULT_POLICY) {
          return 'unavailable';
        }
        return filter.policy && hasWildcard(filter.policy) ? 'invalid' : undefined;
      },
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
      apply: (filter, value) => {
        const paused = value.toLowerCase();
        if (paused !== 'true' && paused !== 'false') {
          return false;
        }
        filter.paused = paused;
        return true;
      },
      // `paused In [false]` misses rules stored without a `paused` value until the backend indexes it as false.
      feedback: (filter) => (filter.paused === 'false' ? 'unavailable' : undefined),
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
      apply: (filter, value) => {
        const state = value.toLowerCase();
        if (!isStateValue(state)) {
          return false;
        }
        filter.state = state;
        return true;
      },
      // RuleList.v2 calls the normal state `inactive`, so its links and users' habits still use it.
      renamedValues: { inactive: 'normal' },
    },
    sharedFilters.health,
  ],
};

function isStateValue(value: string): value is StateValue {
  return Object.hasOwn(STATE_API_VALUES, value);
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

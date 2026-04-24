import { type GrafanaPromRuleDTO, PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { type Chain } from './types';

// TODO(alerting.rulesAPIV2): remove this module once the backend chain endpoint
// returns real rule data. It only exists so the chain rail can be demoed in
// `yarn start` before the API ships.

const DEV_CHAIN_ID_PREFIX = 'dev-chain-';

function buildRecordingRule(folderUid: string): GrafanaPromRuleDTO {
  return {
    uid: `${folderUid}-dev-recording-1`,
    folderUid,
    isPaused: false,
    name: 'hosted_grafana:pause_events:10m',
    query: 'sum by (namespace) (rate(pause_events_total[10m]))',
    type: PromRuleType.Recording,
    health: 'ok',
    labels: { team: 'billing' },
    queriedDatasourceUIDs: ['grafanacloud-dev-logs'],
  };
}

function buildAlertRule(params: {
  folderUid: string;
  uid: string;
  name: string;
  summary: string;
  state: PromAlertingRuleState;
  labels?: Record<string, string>;
  datasourceUid?: string;
  alertCount?: number;
}): GrafanaPromRuleDTO {
  const { folderUid, uid, name, summary, state, labels = {}, datasourceUid, alertCount = 0 } = params;
  const alertInstances =
    alertCount > 0 && state !== PromAlertingRuleState.Inactive
      ? Array.from({ length: alertCount }, (_, i) => ({
          labels: { instance: `host-${i + 1}` },
          annotations: {},
          state: PromAlertingRuleState.Firing as const,
          activeAt: new Date(Date.now() - 60_000).toISOString(),
          value: '1',
        }))
      : undefined;

  return {
    uid,
    folderUid,
    isPaused: false,
    name,
    query: 'sum by (namespace) (grafanacloud_instance_active_series)',
    type: PromRuleType.Alerting,
    state,
    health: 'ok',
    labels,
    annotations: { summary },
    alerts: alertInstances,
    totals: alertInstances ? { alerting: alertInstances.length } : {},
    totalsFiltered: alertInstances ? { alerting: alertInstances.length } : {},
    queriedDatasourceUIDs: datasourceUid ? [datasourceUid] : undefined,
  };
}

function buildDevMockChainRules(folderUid: string): GrafanaPromRuleDTO[] {
  return [
    buildRecordingRule(folderUid),
    buildAlertRule({
      folderUid,
      uid: `${folderUid}-dev-alert-1`,
      name: 'Attributed Metrics Usage [namespace=sum_by]: 10% over 12,000,000 series',
      summary: 'This alert is provisioned by the Grafana Cloud Cost Management and Billing app.',
      state: PromAlertingRuleState.Inactive,
      labels: { severity: 'warning', team: 'billing', env: 'prod', region: 'us-east' },
      datasourceUid: 'grafanacloud-usage',
    }),
    buildAlertRule({
      folderUid,
      uid: `${folderUid}-dev-alert-2`,
      name: 'Attributed Metrics Usage [namespace=AWS/EC2]: 1% over 15,000 series',
      summary: 'This alert is provisioned by the Grafana Cloud Cost Management and Billing app.',
      state: PromAlertingRuleState.Pending,
      labels: { severity: 'warning', team: 'billing', env: 'prod', region: 'us-east' },
      datasourceUid: 'grafanacloud-usage',
    }),
    buildAlertRule({
      folderUid,
      uid: `${folderUid}-dev-alert-3`,
      name: 'Attributed Logs Usage [namespace=prod]: 5% over 200 GiB',
      summary: 'This alert is provisioned by the Grafana Cloud Cost Management and Billing app.',
      state: PromAlertingRuleState.Firing,
      labels: { severity: 'critical', team: 'billing', env: 'prod' },
      datasourceUid: 'grafanacloud-usage',
      alertCount: 3,
    }),
    buildAlertRule({
      folderUid,
      uid: `${folderUid}-dev-alert-4`,
      name: 'Attributed Traces Usage [namespace=staging]: 20% over quota',
      summary: 'This alert is provisioned by the Grafana Cloud Cost Management and Billing app.',
      state: PromAlertingRuleState.Inactive,
      labels: { severity: 'warning', team: 'billing', env: 'staging' },
      datasourceUid: 'grafanacloud-usage',
    }),
  ];
}

export function isDevMockChain(chain: Chain): boolean {
  return process.env.NODE_ENV === 'development' && chain.id.startsWith(DEV_CHAIN_ID_PREFIX);
}

export function getDevMockRulesFor(chain: Chain): GrafanaPromRuleDTO[] | undefined {
  if (!isDevMockChain(chain)) {
    return undefined;
  }
  return buildDevMockChainRules(chain.folderUid);
}

import { HttpResponse, http } from 'msw';

import server from '@grafana/test-utils/server';
import {
  type GrafanaPromAlertingRuleDTO,
  type GrafanaPromRecordingRuleDTO,
  type GrafanaPromRuleGroupDTO,
  PromAlertingRuleState,
  PromRuleType,
} from 'app/types/unified-alerting-dto';

import { mockRuleSearch, ruleSearchUrl } from '../../gma-rule-list/mocks/handlers';

const STATES: Record<PromAlertingRuleState, string | undefined> = {
  [PromAlertingRuleState.Firing]: 'Firing',
  [PromAlertingRuleState.Pending]: 'Pending',
  [PromAlertingRuleState.Inactive]: 'Inactive',
  [PromAlertingRuleState.Recovering]: 'Recovering',
  [PromAlertingRuleState.Unknown]: undefined,
};

const HEALTHS: Record<string, string> = { ok: 'OK', error: 'Error', nodata: 'NoData' };

function item(kind: 'AlertRule' | 'RecordingRule', uid: string, fields: Record<string, unknown>) {
  return {
    resource: {
      group: 'rules.alerting.grafana.app',
      kind,
      name: uid,
      resource: kind === 'AlertRule' ? 'alertrules' : 'recordingrules',
    },
    fields,
  };
}

function alertItem(rule: GrafanaPromAlertingRuleDTO, withStatus: boolean) {
  const totals: Record<string, number | undefined> = rule.totals;
  return item('AlertRule', rule.uid, {
    title: rule.name,
    folder: rule.folderUid,
    paused: rule.isPaused,
    labels: Object.entries(rule.labels ?? {}).map(([key, value]) => `${key}=${value}`),
    ...(withStatus
      ? {
          state: STATES[rule.state],
          health: HEALTHS[rule.health],
          lastError: rule.lastError,
          totalsFiring: totals.alerting,
          totalsPending: totals.pending,
          totalsRecovering: totals.recovering,
          totalsHealthy: totals.normal ?? totals.inactive,
          totalsNoData: totals.nodata,
          totalsError: totals.error,
        }
      : {}),
  });
}

function recordingItem(rule: GrafanaPromRecordingRuleDTO) {
  return item('RecordingRule', rule.uid, {
    title: rule.name,
    folder: rule.folderUid,
    paused: rule.isPaused,
    health: HEALTHS[rule.health],
  });
}

/** Serves the rules of these groups through the rules API search, the way the page reads them. */
export function setGrafanaSearchRules(
  groups: GrafanaPromRuleGroupDTO[],
  { onSearch, withStatus = true }: { onSearch?: () => void; withStatus?: boolean } = {}
) {
  const rules = groups.flatMap((group) => group.rules);
  const alerts = rules.filter((rule) => rule.type === PromRuleType.Alerting);
  const recordings = rules.filter((rule) => rule.type === PromRuleType.Recording);

  mockRuleSearch('alert', () => {
    onSearch?.();
    return { items: alerts.map((rule) => alertItem(rule, withStatus)), metadata: { totalHits: alerts.length } };
  });
  mockRuleSearch('recording', () => ({
    items: recordings.map(recordingItem),
    metadata: { totalHits: recordings.length },
  }));
}

/** A stack with far more rules than the page reads: every page is full, and there is always another. */
export function setGrafanaSearchRulesBeyondTheLimit() {
  mockRuleSearch('alert', (_body, call) => ({
    items: Array.from({ length: 500 }, (_, index) =>
      item('AlertRule', `bulk-${call}-${index}`, {
        title: `Bulk ${call}-${index}`,
        folder: 'f',
        health: 'OK',
        totalsHealthy: 1,
      })
    ),
    metadata: { continue: `page-${call + 1}`, totalHits: 9000, totalHitsRelation: 'lte' },
  }));
  mockRuleSearch('recording', () => ({ items: [], metadata: { totalHits: 0 } }));
}

export function failGrafanaRuleSearch() {
  server.use(http.post(ruleSearchUrl('alert'), () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
}

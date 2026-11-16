import { AlertInstanceTotalState, type AlertInstanceTotals } from 'app/types/unified-alerting';
import {
  type GrafanaPromAlertingRuleDTO,
  type GrafanaPromRecordingRuleDTO,
  PromAlertingRuleState,
  PromRuleType,
} from 'app/types/unified-alerting-dto';

import { type AlertRuleSearchHit } from '../../gma-rule-list/alert-rules/alertRuleSearchHit';
import { type RecordingRuleSearchHit } from '../../gma-rule-list/recording-rules/recordingRuleSearchHit';

/**
 * Turns rules API search hits into the rule objects the home page already summarizes, so the summary does
 * not care which API the rules came from. The hits carry no query, no provenance and no queried data
 * sources, so those fields stay empty.
 */

const HEALTH: Record<string, string> = { OK: 'ok', Recording: 'ok', NoData: 'nodata', Error: 'error' };

function toHealth(health?: string): string {
  return (health && HEALTH[health]) || 'unknown';
}

const STATES: Record<string, PromAlertingRuleState> = {
  Firing: PromAlertingRuleState.Firing,
  Pending: PromAlertingRuleState.Pending,
  Recovering: PromAlertingRuleState.Recovering,
  Inactive: PromAlertingRuleState.Inactive,
  Healthy: PromAlertingRuleState.Inactive,
};

function toTotals(hit: AlertRuleSearchHit): AlertInstanceTotals {
  const totals: AlertInstanceTotals = {};
  const entries: Array<[AlertInstanceTotalState, number | undefined]> = [
    [AlertInstanceTotalState.Alerting, hit.totalsFiring],
    [AlertInstanceTotalState.Pending, hit.totalsPending],
    [AlertInstanceTotalState.Recovering, hit.totalsRecovering],
    [AlertInstanceTotalState.Normal, hit.totalsHealthy],
    [AlertInstanceTotalState.NoData, hit.totalsNoData],
    [AlertInstanceTotalState.Error, hit.totalsError],
  ];
  for (const [state, count] of entries) {
    if (count !== undefined) {
      totals[state] = count;
    }
  }
  return totals;
}

export function alertHitToRule(hit: AlertRuleSearchHit): GrafanaPromAlertingRuleDTO {
  const totals = toTotals(hit);
  return {
    type: PromRuleType.Alerting,
    uid: hit.uid,
    name: hit.title,
    folderUid: hit.folderUid ?? '',
    isPaused: hit.paused ?? false,
    state: (hit.state && STATES[hit.state]) || PromAlertingRuleState.Unknown,
    health: toHealth(hit.health),
    lastError: hit.lastError,
    labels: hit.labels,
    query: '',
    totals,
    totalsFiltered: { ...totals },
  };
}

export function recordingHitToRule(hit: RecordingRuleSearchHit): GrafanaPromRecordingRuleDTO {
  return {
    type: PromRuleType.Recording,
    uid: hit.uid,
    name: hit.title,
    folderUid: hit.folderUid ?? '',
    isPaused: hit.paused ?? false,
    health: toHealth(hit.health),
    lastError: hit.lastError,
    labels: hit.labels,
    query: '',
  };
}

/**
 * The status fields (state, health, instance totals) are only filled in when the stack syncs rule status
 * onto the rules. Without that every rule would read as healthy with no firing instances, so the page needs
 * to know. With no alert rules there is nothing to judge by, so this says yes.
 */
export function hasRuleStatus(alertHits: AlertRuleSearchHit[]): boolean {
  if (alertHits.length === 0) {
    return true;
  }
  return alertHits.some(
    (hit) =>
      hit.state !== undefined ||
      hit.health !== undefined ||
      hit.totalsHealthy !== undefined ||
      hit.totalsFiring !== undefined ||
      hit.totalsPending !== undefined ||
      hit.totalsRecovering !== undefined ||
      hit.totalsNoData !== undefined ||
      hit.totalsError !== undefined
  );
}

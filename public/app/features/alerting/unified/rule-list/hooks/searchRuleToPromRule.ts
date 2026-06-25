import {
  type GetSearchAlertRulesAlertRuleHit,
  type GetSearchRecordingRulesRecordingRuleHit,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import {
  type GrafanaPromAlertingRuleDTO,
  type GrafanaPromRecordingRuleDTO,
  type GrafanaPromRuleDTO,
  PromRuleType,
} from 'app/types/unified-alerting-dto';

// The cross-kind /search endpoint types its items as `any` (the generated union
// resolves to `any`), but each item is a flat object discriminated by `type` that
// matches the per-kind hit shapes. We reuse those generated shapes as our union.
export type AlertRuleSearchHit = GetSearchAlertRulesAlertRuleHit;
export type RecordingRuleSearchHit = GetSearchRecordingRulesRecordingRuleHit;
export type RuleSearchHit = AlertRuleSearchHit | RecordingRuleSearchHit;

export function isAlertRuleSearchHit(hit: RuleSearchHit): hit is AlertRuleSearchHit {
  return hit.type === 'alertrule';
}

/**
 * Maps an alert-rule search hit to a {@link GrafanaPromAlertingRuleDTO}. Search hits are
 * definition-only: they carry no runtime evaluation data, so `query`, `health`, `totals`
 * and `state` have no source.
 */
export function mapAlertRuleHitToDTO(hit: AlertRuleSearchHit): GrafanaPromAlertingRuleDTO {
  // definition-only: /search hits carry no runtime state, so `state` is omitted and cast.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    uid: hit.name,
    name: hit.title,
    folderUid: hit.folder,
    type: PromRuleType.Alerting,
    labels: hit.labels ?? {},
    annotations: hit.annotations ?? {},
    isPaused: Boolean(hit.paused),
    queriedDatasourceUIDs: hit.datasourceUIDs ?? [],
    ...(hit.receiver ? { notificationSettings: { receiver: hit.receiver } } : {}),
    query: '',
    health: '',
    totals: {},
    totalsFiltered: {},
  } as GrafanaPromAlertingRuleDTO;
}

export function mapRecordingRuleHitToDTO(hit: RecordingRuleSearchHit): GrafanaPromRecordingRuleDTO {
  return {
    uid: hit.name,
    name: hit.title,
    folderUid: hit.folder,
    type: PromRuleType.Recording,
    labels: hit.labels ?? {},
    isPaused: Boolean(hit.paused),
    queriedDatasourceUIDs: hit.datasourceUIDs ?? [],
    query: '',
    health: '',
  };
}

export function mapRuleHitToDTO(hit: RuleSearchHit): GrafanaPromRuleDTO {
  return isAlertRuleSearchHit(hit) ? mapAlertRuleHitToDTO(hit) : mapRecordingRuleHitToDTO(hit);
}

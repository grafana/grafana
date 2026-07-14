import {
  type AlertRule,
  type AlertRuleExecErrState,
  type AlertRuleExpression,
  type AlertRuleNoDataState,
  type AlertRuleSpec,
  type RecordingRule,
  type RecordingRuleExpression,
  type RecordingRuleSpec,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { type RuleFormValues } from '../../../types/rule-form';
import { cleanAnnotations, cleanLabels, fixBothInstantAndRangeQuery } from '../../../utils/rule-form';

const ALERT_RULE_API_VERSION = 'rules.alerting.grafana.app/v0alpha1';
const FOLDER_ANNOTATION = 'grafana.app/folder';

// TODO: GrafanaAlertStateDecision is a single enum used for both noDataState and execErrState form
// fields, but the two fields have different valid values — noDataState doesn't accept Error, and
// execErrState doesn't accept NoData. The API schema (AlertRuleNoDataState / AlertRuleExecErrState)
// already models them as separate types. GrafanaAlertStateDecision should be split into two
// separate types to make this constraint explicit in TypeScript and remove the need for the
// defensive fallback cases below.

// Maps the form's noDataState decision to the API type. Error is not a valid NoDataState in the
// API schema, so it falls back to NoData. In practice this case is unreachable because the UI
// picker excludes Error from the noDataState field.
function toApiNoDataState(decision: GrafanaAlertStateDecision): AlertRuleNoDataState {
  switch (decision) {
    case GrafanaAlertStateDecision.OK:
      return 'Ok';
    case GrafanaAlertStateDecision.NoData:
    case GrafanaAlertStateDecision.Alerting:
    case GrafanaAlertStateDecision.KeepLast:
      return decision;
    case GrafanaAlertStateDecision.Error:
      return 'NoData';
  }
}

// Maps the form's execErrState decision to the API type. NoData is not a valid ExecErrState in
// the API schema, so it falls back to Error. In practice this case is unreachable because the UI
// picker excludes NoData from the execErrState field.
function toApiExecErrState(decision: GrafanaAlertStateDecision): AlertRuleExecErrState {
  switch (decision) {
    case GrafanaAlertStateDecision.OK:
      return 'Ok';
    case GrafanaAlertStateDecision.Alerting:
    case GrafanaAlertStateDecision.KeepLast:
    case GrafanaAlertStateDecision.Error:
      return decision;
    case GrafanaAlertStateDecision.NoData:
      return 'Error';
  }
}

export function buildAlertRuleResource(values: RuleFormValues, existingK8sName?: string): AlertRule {
  const folderUid = values.folder?.uid;
  if (!folderUid) {
    throw new Error('Folder UID is required to create a Grafana-managed alert rule');
  }

  if (!values.condition) {
    throw new Error('Condition is required to create a Grafana-managed alert rule');
  }

  const labels = toRecord(cleanLabels(values.labels));
  const annotations = toRecord(cleanAnnotations(values.annotations));

  const spec = {
    title: values.name,
    expressions: toAlertExpressionMap(values),
    trigger: { interval: values.evaluateEvery },
    annotations,
    labels,
    noDataState: toApiNoDataState(values.noDataState),
    execErrState: toApiExecErrState(values.execErrState),
    for: values.evaluateFor,
    keepFiringFor: values.keepFiringFor,
    paused: Boolean(values.isPaused),
    missingSeriesEvalsToResolve: values.missingSeriesEvalsToResolve
      ? Number(values.missingSeriesEvalsToResolve)
      : undefined,
    notificationSettings: getNotificationSettings(values),
  } satisfies AlertRuleSpec;

  return {
    apiVersion: ALERT_RULE_API_VERSION,
    kind: 'AlertRule',
    metadata: {
      name: existingK8sName,
      annotations: { [FOLDER_ANNOTATION]: folderUid },
      labels: { ...labels, [FOLDER_ANNOTATION]: folderUid },
    },
    spec,
  };
}

export function buildRecordingRuleResource(values: RuleFormValues, existingK8sName?: string): RecordingRule {
  const folderUid = values.folder?.uid;
  if (!folderUid) {
    throw new Error('Folder UID is required to create a Grafana-managed recording rule');
  }

  const labels = toRecord(cleanLabels(values.labels));

  const spec = {
    title: values.name,
    metric: values.metric ?? values.name,
    targetDatasourceUID: values.targetDatasourceUid ?? '',
    trigger: { interval: values.evaluateEvery },
    paused: Boolean(values.isPaused),
    expressions: toRecordingExpressionMap(values),
    labels,
  } satisfies RecordingRuleSpec;

  return {
    apiVersion: ALERT_RULE_API_VERSION,
    kind: 'RecordingRule',
    metadata: {
      name: existingK8sName,
      annotations: { [FOLDER_ANNOTATION]: folderUid },
      labels: { ...labels, [FOLDER_ANNOTATION]: folderUid },
    },
    spec,
  };
}

function toAlertExpressionMap(values: RuleFormValues): Record<string, AlertRuleExpression> {
  return values.queries.reduce<Record<string, AlertRuleExpression>>((acc, query) => {
    acc[fixBothInstantAndRangeQuery(query).refId] = toExpression(query, values.condition);
    return acc;
  }, {});
}

function toRecordingExpressionMap(values: RuleFormValues): Record<string, RecordingRuleExpression> {
  return values.queries.reduce<Record<string, RecordingRuleExpression>>((acc, query) => {
    acc[fixBothInstantAndRangeQuery(query).refId] = toExpression(query, values.condition);
    return acc;
  }, {});
}

function toExpression(
  query: RuleFormValues['queries'][number],
  condition: RuleFormValues['condition']
): AlertRuleExpression {
  const normalizedQuery = fixBothInstantAndRangeQuery(query);
  const isSource = normalizedQuery.refId === condition;
  const hasRelativeTimeRange = normalizedQuery.relativeTimeRange !== undefined;
  const isExpression = isExpressionQuery(normalizedQuery.model);

  return {
    model: normalizedQuery.model,
    queryType: normalizedQuery.queryType || undefined,
    datasourceUID: isExpression ? undefined : normalizedQuery.datasourceUid,
    relativeTimeRange:
      hasRelativeTimeRange && normalizedQuery.relativeTimeRange
        ? {
            from: `${normalizedQuery.relativeTimeRange.from}s`,
            to: `${normalizedQuery.relativeTimeRange.to}s`,
          }
        : undefined,
    source: isSource,
  };
}

// Tags from the legacy alertingApi cache that the generated app-platform mutations
// don't invalidate (they live on a separate `createApi` instance with its own tag set).
// Dispatch these after each successful create/replace so list, details, and group views refetch.
export function legacyRuleCacheTagsForUid(uid: string) {
  return [
    'CombinedAlertRule' as const,
    'RuleNamespace' as const,
    'RuleGroup' as const,
    'GrafanaPrometheusGroups' as const,
    { type: 'GrafanaRulerRule' as const, id: uid },
    { type: 'GrafanaRulerRuleVersion' as const, id: uid },
  ];
}

function toRecord(items: Array<{ key: string; value: string }>): Record<string, string> {
  return items.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
}

function getNotificationSettings(values: RuleFormValues): AlertRuleSpec['notificationSettings'] {
  const settings = values.contactPoints?.grafana;
  if (!values.manualRouting || !settings?.selectedContactPoint) {
    return undefined;
  }

  return {
    type: 'SimplifiedRouting',
    receiver: settings.selectedContactPoint,
    muteTimeIntervals: settings.muteTimeIntervals,
    activeTimeIntervals: settings.activeTimeIntervals,
    groupBy: settings.overrideGrouping ? settings.groupBy : undefined,
    groupWait: settings.overrideTimings ? settings.groupWaitValue : undefined,
    groupInterval: settings.overrideTimings ? settings.groupIntervalValue : undefined,
    repeatInterval: settings.overrideTimings ? settings.repeatIntervalValue : undefined,
  };
}

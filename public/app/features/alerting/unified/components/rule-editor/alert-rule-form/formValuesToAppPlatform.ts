import {
  type AlertRule,
  type AlertRuleExecErrState,
  type AlertRuleExpression,
  type AlertRuleNoDataState,
  type AlertRuleSpec,
  type RecordingRule,
  type RecordingRuleExpression,
  type RecordingRuleSpec,
  type useCreateAlertRuleMutation,
  type useCreateRecordingRuleMutation,
  type useReplaceAlertRuleMutation,
  type useReplaceRecordingRuleMutation,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { type RuleFormValues } from '../../../types/rule-form';
import { cleanAnnotations, cleanLabels, fixBothInstantAndRangeQuery } from '../../../utils/rule-form';

const ALERT_RULE_API_VERSION = 'rules.alerting.grafana.app/v0alpha1';
const FOLDER_ANNOTATION = 'grafana.app/folder';

// The form's GrafanaAlertStateDecision enum and the generated AlertRule*State unions overlap
// but use different casing for "Ok"/"OK". Map at the wire boundary so the body matches the API.
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

export function buildAlertRuleResource(values: RuleFormValues): AlertRule {
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
      annotations: { [FOLDER_ANNOTATION]: folderUid },
      labels: { ...labels, [FOLDER_ANNOTATION]: folderUid },
    },
    spec,
  };
}

export function buildRecordingRuleResource(values: RuleFormValues): RecordingRule {
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
      annotations: { [FOLDER_ANNOTATION]: folderUid },
      labels: { ...labels, [FOLDER_ANNOTATION]: folderUid },
    },
    spec,
  };
}

export function toAlertExpressionMap(values: RuleFormValues): Record<string, AlertRuleExpression> {
  return values.queries.reduce<Record<string, AlertRuleExpression>>((acc, query) => {
    acc[fixBothInstantAndRangeQuery(query).refId] = toExpression(query, values.condition);
    return acc;
  }, {});
}

export function toRecordingExpressionMap(values: RuleFormValues): Record<string, RecordingRuleExpression> {
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

export type UngroupedRuleSaveArgs = {
  values: RuleFormValues;
  isRecordingRule: boolean;
  existingUid: string | undefined;
  createAlertRule: ReturnType<typeof useCreateAlertRuleMutation>[0];
  replaceAlertRule: ReturnType<typeof useReplaceAlertRuleMutation>[0];
  createRecordingRule: ReturnType<typeof useCreateRecordingRuleMutation>[0];
  replaceRecordingRule: ReturnType<typeof useReplaceRecordingRuleMutation>[0];
};

export async function saveUngroupedGrafanaRule({
  values,
  isRecordingRule,
  existingUid,
  createAlertRule,
  replaceAlertRule,
  createRecordingRule,
  replaceRecordingRule,
}: UngroupedRuleSaveArgs): Promise<string | null> {
  if (existingUid) {
    // Replace path: server echoes the same name we sent in the URL — no need to read it back.
    if (isRecordingRule) {
      const recordingRule = withMetadataName(buildRecordingRuleResource(values), existingUid);
      await replaceRecordingRule({ name: existingUid, recordingRule }).unwrap();
    } else {
      const alertRule = withMetadataName(buildAlertRuleResource(values), existingUid);
      await replaceAlertRule({ name: existingUid, alertRule }).unwrap();
    }
    return existingUid;
  }

  // Create path: server generates the name; pull it off the response. Mirrors the
  // pattern in `useCreateSyncJob` — return null on missing name so the caller can
  // surface a user-facing error and skip the redirect, rather than throwing.
  const created = isRecordingRule
    ? await createRecordingRule({ recordingRule: buildRecordingRuleResource(values) }).unwrap()
    : await createAlertRule({ alertRule: buildAlertRuleResource(values) }).unwrap();

  return created.metadata.name ?? null;
}

function withMetadataName<T extends { metadata: { name?: string } }>(resource: T, name: string): T {
  return { ...resource, metadata: { ...resource.metadata, name } };
}

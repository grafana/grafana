import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { toRulerNotificationSettings } from '@grafana/alerting/convert';
import { fromRuleNotificationSettings } from '@grafana/alerting/unstable';
import {
  type AlertRule,
  type AlertRuleExpression,
  type RecordingRule,
  useGetAlertRuleQuery,
  useGetRecordingRuleQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionDatasourceUID, type ExpressionQuery } from 'app/features/expressions/types';
import { type RuleWithLocation } from 'app/types/unified-alerting';
import {
  type AlertQuery,
  GrafanaAlertStateDecision,
  type GrafanaRuleDefinition,
  type RulerGrafanaRuleDTO,
} from 'app/types/unified-alerting-dto';

import { isNotFoundError } from '../api/util';
import { type RuleKind } from '../gma-rule-list/shared/ruleKind';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { K8sAnnotations } from '../utils/k8s/constants';
import { NO_GROUP_PREFIX } from '../utils/rules';
import { formatPrometheusDuration, parsePrometheusDuration } from '../utils/time';

import { areQueriesTransformableToSimpleCondition } from './formProcessing';

const FOLDER_ANNOTATION = 'grafana.app/folder';
const GROUP_LABEL = 'grafana.com/group';

export interface EditableRuleState {
  loading: boolean;
  error?: unknown;
  result?: RuleWithLocation;
  resourceVersion?: string;
}

/**
 * Loads a Grafana-managed rule from the rules API. Alert and recording rules have separate endpoints and
 * the UID doesn't say which one a rule lives in, so without a `kind` the alert rule is tried first and
 * the recording rule only after a 404.
 */
export function useK8sRuleWithLocation(uid: string, kind?: RuleKind): EditableRuleState {
  const alertRule = useGetAlertRuleQuery(kind === 'recording' ? skipToken : { name: uid }, {
    refetchOnMountOrArgChange: true,
  });
  const tryRecordingRule = kind === 'recording' || (!kind && isNotFoundError(alertRule.error));
  const recordingRule = useGetRecordingRuleQuery(tryRecordingRule ? { name: uid } : skipToken, {
    refetchOnMountOrArgChange: true,
  });
  const resource = alertRule.currentData ?? recordingRule.currentData;
  // The GMA list caches the same rules, so wait for the editor's own fetch instead of showing that copy.
  const alertPending = kind !== 'recording' && (alertRule.isUninitialized || alertRule.isFetching);
  const recordingPending = tryRecordingRule && (recordingRule.isUninitialized || recordingRule.isFetching);

  return useMemo(() => {
    if (alertPending || recordingPending) {
      return { loading: true };
    }
    if (resource) {
      return {
        loading: false,
        result: k8sRuleToRuleWithLocation(resource),
        resourceVersion: resource.metadata.resourceVersion,
      };
    }
    const error = [alertRule.error, recordingRule.error].find((err) => err && !isNotFoundError(err));
    return { loading: false, error };
  }, [resource, alertPending, alertRule.error, recordingPending, recordingRule.error]);
}

/**
 * Turns a rules API resource into the ruler-shaped rule the rule editor reads,
 * so the editor can load a rule from the same API it saves it to.
 */
export function k8sRuleToRuleWithLocation(resource: AlertRule | RecordingRule): RuleWithLocation<RulerGrafanaRuleDTO> {
  const uid = resource.metadata.name ?? '';
  const folderUid = resource.metadata.annotations?.[FOLDER_ANNOTATION] ?? '';
  const groupName = resource.metadata.labels?.[GROUP_LABEL] ?? `${NO_GROUP_PREFIX}${uid}`;
  const { expressions, trigger, title, labels, paused } = resource.spec;
  const condition = Object.keys(expressions).find((refId) => expressions[refId].source) ?? '';

  const data = Object.entries(expressions).map(([refId, expression]) => toAlertQuery(refId, expression));

  const definition: GrafanaRuleDefinition = {
    uid,
    title,
    namespace_uid: folderUid,
    rule_group: groupName,
    condition,
    data,
    is_paused: Boolean(paused),
    intervalSeconds: parsePrometheusDuration(trigger.interval) / 1000,
    provenance: resource.metadata.annotations?.[K8sAnnotations.Provenance],
    // The rules API doesn't store which editor mode the rule was built in, so pick the mode the rule fits.
    metadata: {
      editor_settings: {
        simplified_query_and_expressions_section: areQueriesTransformableToSimpleCondition(
          data.filter((query) => !isExpressionQuery(query.model)),
          data.filter((query): query is AlertQuery<ExpressionQuery> => isExpressionQuery(query.model))
        ),
        simplified_notifications_section: !isRecordingRule(resource) && Boolean(resource.spec.notificationSettings),
      },
    },
  };

  const rule: RulerGrafanaRuleDTO = isRecordingRule(resource)
    ? {
        grafana_alert: {
          ...definition,
          record: {
            metric: resource.spec.metric,
            from: condition,
            target_datasource_uid: resource.spec.targetDatasourceUID || undefined,
          },
        },
        labels,
      }
    : alertRuleDTO(resource, definition);

  return {
    ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
    namespace: folderUid,
    group: { name: groupName, interval: trigger.interval, rules: [rule] },
    rule,
  };
}

function isRecordingRule(resource: AlertRule | RecordingRule): resource is RecordingRule {
  return resource.kind === 'RecordingRule';
}

function alertRuleDTO({ spec }: AlertRule, definition: GrafanaRuleDefinition): RulerGrafanaRuleDTO {
  return {
    grafana_alert: {
      ...definition,
      no_data_state:
        spec.noDataState === 'Ok' ? GrafanaAlertStateDecision.OK : GrafanaAlertStateDecision[spec.noDataState],
      exec_err_state:
        spec.execErrState === 'Ok' ? GrafanaAlertStateDecision.OK : GrafanaAlertStateDecision[spec.execErrState],
      notification_settings: toRulerNotificationSettings(fromRuleNotificationSettings(spec.notificationSettings)),
      missing_series_evals_to_resolve: spec.missingSeriesEvalsToResolve,
    },
    for: toPromDuration(spec.for),
    keep_firing_for: toPromDuration(spec.keepFiringFor),
    labels: spec.labels,
    annotations: spec.annotations,
  };
}

// The rules API returns Go durations ("40m0s"); the editor's quick picks match "40m".
function toPromDuration(duration?: string) {
  return duration && formatPrometheusDuration(parsePrometheusDuration(duration));
}

function toAlertQuery(refId: string, expression: AlertRuleExpression): AlertQuery {
  const { relativeTimeRange } = expression;
  return {
    refId,
    queryType: expression.queryType ?? '',
    datasourceUid: expression.datasourceUID ?? ExpressionDatasourceUID,
    model: { ...expression.model, refId },
    relativeTimeRange: relativeTimeRange && {
      from: parsePrometheusDuration(relativeTimeRange.from) / 1000,
      to: parsePrometheusDuration(relativeTimeRange.to) / 1000,
    },
  };
}

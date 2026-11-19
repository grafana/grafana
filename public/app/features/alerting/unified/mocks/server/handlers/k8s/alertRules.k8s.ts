import { HttpResponse, http } from 'msw';

import {
  API_GROUP,
  API_VERSION,
  type AlertRule,
  type AlertRuleExecErrState,
  type AlertRuleExpression,
  type AlertRuleNoDataState,
  type RecordingRule,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { grafanaRulerRule } from 'app/features/alerting/unified/mocks/grafanaRulerApi';
import { isUngroupedRuleGroup } from 'app/features/alerting/unified/utils/rules';
import { type RulerGrafanaRuleDTO, type RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

export const MOCK_K8S_RULE_RESOURCE_VERSION = '7';

/** The rules API resource the backend serves for a ruler-shaped Grafana rule in `group`. */
export function mockK8sRuleFromRuler(
  { grafana_alert: rule, ...ruler }: RulerGrafanaRuleDTO,
  group: RulerRuleGroupDTO
): AlertRule | RecordingRule {
  const metadata = {
    name: rule.uid,
    resourceVersion: MOCK_K8S_RULE_RESOURCE_VERSION,
    annotations: { 'grafana.app/folder': rule.namespace_uid },
    labels: (isUngroupedRuleGroup(group.name) ? {} : { 'grafana.com/group': group.name }) as Record<string, string>,
  };
  const expressions = Object.fromEntries(
    rule.data.map((query): [string, AlertRuleExpression] => [
      query.refId,
      {
        model: query.model,
        queryType: query.queryType || undefined,
        datasourceUID: query.datasourceUid === '__expr__' ? undefined : query.datasourceUid,
        relativeTimeRange: query.relativeTimeRange && {
          from: `${query.relativeTimeRange.from}s`,
          to: `${query.relativeTimeRange.to}s`,
        },
        source: query.refId === rule.condition,
      },
    ])
  );
  const trigger = { interval: group.interval ?? '1m' };

  if (rule.record) {
    return {
      apiVersion: `${API_GROUP}/${API_VERSION}`,
      kind: 'RecordingRule',
      metadata,
      spec: {
        title: rule.title,
        metric: rule.record.metric,
        targetDatasourceUID: rule.record.target_datasource_uid ?? '',
        expressions,
        trigger,
        labels: ruler.labels,
      },
    };
  }

  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'AlertRule',
    metadata,
    spec: {
      title: rule.title,
      expressions,
      trigger,
      noDataState: (rule.no_data_state === 'OK' ? 'Ok' : (rule.no_data_state ?? 'NoData')) as AlertRuleNoDataState,
      execErrState: (rule.exec_err_state === 'OK' ? 'Ok' : (rule.exec_err_state ?? 'Error')) as AlertRuleExecErrState,
      for: ruler.for,
      keepFiringFor: ruler.keep_firing_for,
      labels: ruler.labels,
      annotations: ruler.annotations,
      paused: rule.is_paused,
    },
  };
}

export function mockK8sAlertRule({ uid, title }: { uid: string; title: string }): AlertRule {
  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'AlertRule',
    metadata: { name: uid },
    spec: {
      title,
      expressions: {},
      execErrState: 'Error',
      noDataState: 'NoData',
      trigger: { interval: '1m' },
    },
  };
}

export const getAlertRuleHandler = (
  rules: AlertRule[] = [
    mockK8sAlertRule({ uid: grafanaRulerRule.grafana_alert.uid, title: grafanaRulerRule.grafana_alert.title }),
  ]
) =>
  http.get<{ namespace: string; name: string }>(
    `/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/alertrules/:name`,
    ({ params: { name } }) => {
      const rule = rules.find((r) => r.metadata.name === name);
      if (!rule) {
        return HttpResponse.json({ kind: 'Status', status: 'Failure', reason: 'NotFound', code: 404 }, { status: 404 });
      }
      return HttpResponse.json(rule);
    }
  );

export const getRulesAPIGroupHandler = (versions: string[] = ['v1beta1', API_VERSION]) =>
  http.get(`/apis/${API_GROUP}/`, () =>
    HttpResponse.json({
      kind: 'APIGroup',
      apiVersion: 'v1',
      name: API_GROUP,
      versions: versions.map((version) => ({ groupVersion: `${API_GROUP}/${version}`, version })),
      preferredVersion: { groupVersion: `${API_GROUP}/${versions[0]}`, version: versions[0] },
    })
  );

const handlers = [getAlertRuleHandler(), getRulesAPIGroupHandler()];
export default handlers;

import { HttpResponse, http } from 'msw';

import { API_GROUP, API_VERSION, type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { grafanaRulerRule } from 'app/features/alerting/unified/mocks/grafanaRulerApi';

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

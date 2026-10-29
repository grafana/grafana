import { HttpResponse, http } from 'msw';

import { API_GROUP, API_VERSION, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

export const getRecordingRuleHandler = (rules: RecordingRule[] = []) =>
  http.get<{ namespace: string; name: string }>(
    `/apis/${API_GROUP}/${API_VERSION}/namespaces/:namespace/recordingrules/:name`,
    ({ params: { name } }) => {
      const rule = rules.find((r) => r.metadata.name === name);
      if (!rule) {
        return HttpResponse.json({ kind: 'Status', status: 'Failure', reason: 'NotFound', code: 404 }, { status: 404 });
      }
      return HttpResponse.json(rule);
    }
  );

const handlers = [getRecordingRuleHandler()];
export default handlers;

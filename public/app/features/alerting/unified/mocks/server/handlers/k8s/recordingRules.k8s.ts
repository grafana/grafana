import { HttpResponse, http } from 'msw';

import { type RecordingRuleList } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

const RULES_ALERTING_API_SERVER_BASE_URL = '/apis/rules.alerting.grafana.app/v0alpha1';

const emptyRecordingRuleList: RecordingRuleList = {
  apiVersion: 'rules.alerting.grafana.app/v0alpha1',
  kind: 'RecordingRuleList',
  items: [],
  metadata: {},
};

const listNamespacedRecordingRuleHandler = () =>
  http.get<{ namespace: string }>(`${RULES_ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/recordingrules`, () =>
    HttpResponse.json(emptyRecordingRuleList)
  );

const handlers = [listNamespacedRecordingRuleHandler()];
export default handlers;

import { HttpResponse, http } from 'msw';

import { type InhibitionRuleList } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';

const emptyInhibitionRuleList = getK8sResponse<InhibitionRuleList['items'][number]>('InhibitionRuleList', []);

const listNamespacedInhibitionRuleHandler = () =>
  http.get<{ namespace: string }>(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/inhibitionrules`, () => {
    return HttpResponse.json(emptyInhibitionRuleList);
  });

const handlers = [listNamespacedInhibitionRuleHandler()];
export default handlers;

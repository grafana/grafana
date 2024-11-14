import { HttpResponse, http } from 'msw';

import { AlertingQueryResponse } from 'app/features/alerting/unified/state/AlertingQueryRunner';

const defaultPostEvalResponse = {
  results: {},
};
const postEvalHandler = (response: AlertingQueryResponse = defaultPostEvalResponse) =>
  http.post('/api/v1/eval', () => {
    return HttpResponse.json(response);
  });

const handlers = [postEvalHandler()];
export default handlers;

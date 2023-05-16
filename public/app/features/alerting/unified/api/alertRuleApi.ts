import { AlertQuery } from 'app/types/unified-alerting-dto';

import { AlertingQueryResponse } from '../state/AlertingQueryRunner';

import { alertingApi } from './alertingApi';

const evalUrl = '/api/v1/eval';
export const alertRuleApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    eval: build.query<AlertingQueryResponse, { alertQueries: AlertQuery[] }>({
      query: ({ alertQueries }) => ({
        url: evalUrl,
        data: { data: alertQueries },
        method: 'POST',
      }),
    }),
  }),
});

import { getTemplateSrv } from '@grafana/runtime';
import { api } from 'app/percona/shared/helpers/api';

import { PTSummaryRequest, PTSummaryResponse, DatabaseSummaryRequest } from './PTSummary.types';

const BASE_URL = '/v1/actions';

export const PTSummaryService = {
  async getPTSummary(variableName: string) {
    const body: PTSummaryRequest = { node_id: getTemplateSrv().replace(`$${variableName || 'node_id'}`) };
    return api.post<PTSummaryResponse, any>(`${BASE_URL}:startNodeAction`, body, true);
  },
  async getMysqlPTSummary(variableName: string) {
    const body: DatabaseSummaryRequest = {
      pt_mysql_summary: {
        service_id: getTemplateSrv().replace(`$${variableName || 'service_name'}`),
      },
    };

    return api.post<PTSummaryResponse, any>(`${BASE_URL}:startServiceAction`, body, true);
  },
  async getPostgresqlPTSummary(variableName: string) {
    const body: DatabaseSummaryRequest = {
      pt_postgres_summary: {
        service_id: getTemplateSrv().replace(`$${variableName || 'service_name'}`),
      },
    };

    return api.post<PTSummaryResponse, any>(`${BASE_URL}:startServiceAction`, body, true);
  },
  async getMongodbPTSummary(variableName: string) {
    const body: DatabaseSummaryRequest = {
      pt_mongodb_summary: {
        service_id: getTemplateSrv().replace(`$${variableName || 'service-name'}`),
      },
    };

    return api.post<PTSummaryResponse, any>(`${BASE_URL}:startServiceAction`, body, true);
  },
};

import { getTemplateSrv } from '@grafana/runtime';
import { apiManagement } from 'app/percona/shared/helpers/api';

import { PTSummaryRequest, PTSummaryResponse, DatabaseSummaryRequest } from './PTSummary.types';

export const PTSummaryService = {
  async getPTSummary(variableName: string) {
    const body: PTSummaryRequest = { node_id: getTemplateSrv().replace(`$${variableName || 'node_id'}`) };

    return apiManagement.post<PTSummaryResponse, any>('/Actions/StartPTSummary', body, true);
  },
  async getMysqlPTSummary(variableName: string) {
    const body: DatabaseSummaryRequest = {
      service_id: getTemplateSrv().replace(`$${variableName || 'service_name'}`),
    };

    return apiManagement.post<PTSummaryResponse, any>('/Actions/StartPTMySQLSummary', body, true);
  },
  async getPostgresqlPTSummary(variableName: string) {
    const body: DatabaseSummaryRequest = {
      service_id: getTemplateSrv().replace(`$${variableName || 'service_name'}`),
    };

    return apiManagement.post<PTSummaryResponse, any>('/Actions/StartPTPgSummary', body, true);
  },
  async getMongodbPTSummary(variableName: string) {
    const body: DatabaseSummaryRequest = {
      service_id: getTemplateSrv().replace(`$${variableName || 'service-name'}`),
    };

    return apiManagement.post<PTSummaryResponse, any>('/Actions/StartPTMongoDBSummary', body, true);
  },
};

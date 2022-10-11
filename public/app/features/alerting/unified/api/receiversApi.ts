import { ContactPointsState, ReceiversStateDTO } from 'app/types';

import { getDatasourceAPIUid } from '../utils/datasource';

import { alertingApi } from './alertingApi';
import { contactPointsStateDtoToModel } from './grafana';

export const receiversApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    contactPointsState: build.query<ContactPointsState, string>({
      query: (amSourceName) => ({
        url: `/api/alertmanager/${getDatasourceAPIUid(amSourceName)}/config/api/v1/receivers`,
      }),
      transformResponse: (receivers: ReceiversStateDTO[]) => {
        return contactPointsStateDtoToModel(receivers);
      },
    }),
  }),
});

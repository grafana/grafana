import { ContactPointsState, ReceiversStateDTO } from 'app/types';

import { CONTACT_POINTS_STATE_INTERVAL_MS } from '../utils/constants';
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

export const useGetContactPointsState = (alertManagerSourceName: string) => {
  const contactPointsStateEmpty: ContactPointsState = { receivers: {}, errorCount: 0 };
  const { currentData: contactPointsState } = receiversApi.useContactPointsStateQuery(alertManagerSourceName ?? '', {
    skip: !alertManagerSourceName,
    pollingInterval: CONTACT_POINTS_STATE_INTERVAL_MS,
  });
  return contactPointsState ?? contactPointsStateEmpty;
};

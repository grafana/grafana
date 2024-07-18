import { api } from 'app/percona/shared/helpers/api';

import {
  GetUpdatesParams,
  GetUpdateStatusBody,
  GetUpdatesResponse,
  GetUpdateStatusResponse,
  StartUpdateResponse,
} from './types';

export const getCurrentVersion = (params: GetUpdatesParams = { force: false }) =>
  api.get<GetUpdatesResponse, GetUpdatesParams>(`/v1/server/updates`, false, {
    params,
  });
export const startUpdate = () => api.post<StartUpdateResponse, {}>('/v1/server/updates:start', {});
export const getUpdateStatus = (body: GetUpdateStatusBody) =>
  api.post<GetUpdateStatusResponse, GetUpdateStatusBody>('/v1/server/updates:getStatus', body);

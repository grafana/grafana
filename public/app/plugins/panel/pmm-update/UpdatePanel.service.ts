import { api } from 'app/percona/shared/helpers/api';

import {
  GetUpdatesBody,
  GetUpdateStatusBody,
  GetUpdatesResponse,
  GetUpdateStatusResponse,
  StartUpdateResponse,
} from './types';

export const getCurrentVersion = (body: GetUpdatesBody = { force: false }) =>
  api.post<GetUpdatesResponse, GetUpdatesBody>('/v1/Updates/Check', body, true);
export const startUpdate = () => api.post<StartUpdateResponse, {}>('/v1/Updates/Start', {});
export const getUpdateStatus = (body: GetUpdateStatusBody) =>
  api.post<GetUpdateStatusResponse, GetUpdateStatusBody>('/v1/Updates/Status', body);

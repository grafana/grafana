import {
  CheckUpdatesChangelogsPayload,
  SnoozePayloadBody,
  SnoozePayloadResponse,
} from 'app/percona/shared/core/reducers/updates';

import { api } from '../../helpers/api';

import { CheckUpdatesBody, CheckUpdatesResponse } from './Updates.types';

export const UpdatesService = {
  getCurrentVersion: (body: CheckUpdatesBody = { force: false }) =>
    api.get<CheckUpdatesResponse, CheckUpdatesBody>('/v1/server/updates', false, { params: body }),

  getUpdatesChangelogs: () => api.get<CheckUpdatesChangelogsPayload, void>('/v1/server/updates/changelogs', false),

  setSnoozeCurrentVersion: (body: SnoozePayloadBody) =>
    api.put<SnoozePayloadResponse, SnoozePayloadBody>('/v1/users/me', body, true),

  getSnoozeCurrentVersion: () => api.get<SnoozePayloadResponse, void>('/v1/users/me', false),
};

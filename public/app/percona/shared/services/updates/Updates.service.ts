import { CheckUpdatesChangeLogsResponse } from 'app/percona/shared/core/reducers/updates';

import { api } from '../../helpers/api';

import { CheckUpdatesParams, CheckUpdatesResponse } from './Updates.types';

export const UpdatesService = {
  getCurrentVersion: (body: CheckUpdatesParams = { force: false }) =>
    api.get<CheckUpdatesResponse, CheckUpdatesParams>('/v1/server/updates', true, { params: body }),

  getUpdatesChangelogs: () => api.get<CheckUpdatesChangeLogsResponse, void>('/v1/server/updates/changelogs', false),
};

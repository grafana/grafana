import { api } from '../../helpers/api';

import { CheckUpdatesParams, CheckUpdatesResponse } from './Updates.types';

export const UpdatesService = {
  getCurrentVersion: (params: CheckUpdatesParams = { force: false }) =>
    api.get<CheckUpdatesResponse, CheckUpdatesParams>('/v1/server/updates', true, { params }),
};

import { api } from '../../helpers/api';

import { CheckUpdatesBody, CheckUpdatesResponse } from './Updates.types';

export const UpdatesService = {
  getCurrentVersion: (body: CheckUpdatesBody = { force: false }) =>
    api.post<CheckUpdatesResponse, CheckUpdatesBody>('/v1/Updates/Check', body, true),
};

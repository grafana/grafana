import { CancelToken } from 'axios';

import { api } from '../../helpers/api';

import { Advisor } from './Advisors.types';

const BASE_URL = `/v1/management/Advisors`;

export const AdvisorsService = {
  async list(token?: CancelToken, disableNotifications?: boolean): Promise<{ advisors: Advisor[] }> {
    return api.post<{ advisors: Advisor[] }, void>(`${BASE_URL}/List`, undefined, disableNotifications, token);
  },
};

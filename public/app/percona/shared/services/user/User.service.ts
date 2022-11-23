import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { UserStatusResponse, UserDetailsResponse, UserDetailsPutPayload } from './User.types';

const BASE_URL = '/v1/Platform';

export const UserService = {
  async getUserStatus(cancelToken?: CancelToken, disableNotifications = false): Promise<boolean> {
    const { is_platform_user }: UserStatusResponse = await api.post(
      `${BASE_URL}/UserStatus`,
      {},
      disableNotifications,
      cancelToken
    );
    return is_platform_user;
  },
  getUserDetails: async (): Promise<UserDetailsResponse> => await api.get('/v1/user', true),
  async setProductTourCompleted(completed: boolean): Promise<UserDetailsResponse> {
    const payload: UserDetailsPutPayload = { product_tour_completed: completed };
    return await api.put('/v1/user', payload);
  },
  async setAlertingTourCompeted(completed: boolean): Promise<UserDetailsResponse> {
    const payload: UserDetailsPutPayload = { alerting_tour_completed: completed };
    return await api.put('/v1/user', payload);
  },
};

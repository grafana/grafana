import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { UserStatusResponse, UserDetailsResponse, UserDetailsPutPayload, UserListResponse } from './User.types';

const BASE_URL = '/v1/platform';

export const UserService = {
  async getUserStatus(cancelToken?: CancelToken, disableNotifications = false): Promise<boolean> {
    const { is_platform_user }: UserStatusResponse = await api.get(`${BASE_URL}/user`, disableNotifications, {
      cancelToken,
    });
    return is_platform_user;
  },
  getUserDetails: async (): Promise<UserDetailsResponse> => await api.get('/v1/users/me', true),
  async setProductTourCompleted(completed: boolean): Promise<UserDetailsResponse> {
    const payload: UserDetailsPutPayload = { product_tour_completed: completed };
    return await api.put('/v1/users/me', payload);
  },
  async setAlertingTourCompeted(completed: boolean): Promise<UserDetailsResponse> {
    const payload: UserDetailsPutPayload = { alerting_tour_completed: completed };
    return await api.put('/v1/users/me', payload);
  },
  async getUsersList(): Promise<UserListResponse> {
    return await api.get('/v1/users');
  },
};

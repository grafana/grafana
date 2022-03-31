import { CancelToken } from 'axios';
import { api } from 'app/percona/shared/helpers/api';
import { UserStatusResponse } from './User.types';

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
};

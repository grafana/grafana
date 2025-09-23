import { UserListItemResponse } from 'app/percona/shared/services/user/User.types';

import { UserItem } from './users.types';

export const toUserItem = (user: UserListItemResponse): UserItem => ({
  userId: user.user_id,
  roleIds: user.role_ids,
});

export const toMap = (users: UserItem[]): Record<number, UserItem> =>
  users.reduce(
    (prev, curr) => ({
      ...prev,
      [curr.userId]: curr,
    }),
    {}
  );

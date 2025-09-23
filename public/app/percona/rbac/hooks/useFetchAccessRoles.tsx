import { useEffect } from 'react';

import { fetchRolesAction } from 'app/percona/shared/core/reducers/roles/roles';
import { fetchUsersListAction } from 'app/percona/shared/core/reducers/users/users';
import { useDispatch } from 'app/types';

import { useAccessRolesEnabled } from './useAccessRolesEnabled';

export const useFetchAccessRoles = () => {
  const dispatch = useDispatch();
  const enabled = useAccessRolesEnabled();

  useEffect(() => {
    if (enabled) {
      dispatch(fetchRolesAction());
      dispatch(fetchUsersListAction());
    }
  }, [enabled, dispatch]);
};

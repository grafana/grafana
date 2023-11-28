import { useEffect } from 'react';

import { fetchRolesAction } from 'app/percona/shared/core/reducers/roles/roles';
import { fetchUsersListAction } from 'app/percona/shared/core/reducers/users/users';
import { useDispatch } from 'app/types';

export const useFetchAccessRoles = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // fetch in the header component
    // to prevent modifying grafana code
    dispatch(fetchRolesAction());
    dispatch(fetchUsersListAction());
  }, [dispatch]);
};

import React, { FC, useEffect } from 'react';

import { HorizontalGroup, Icon, Tooltip } from '@grafana/ui';
import { fetchRolesAction } from 'app/percona/shared/core/reducers/roles/roles';
import { fetchUsersListAction } from 'app/percona/shared/core/reducers/users/users';
import { useAppDispatch } from 'app/store/store';

import { Messages } from './AccessRoleHeader.messages';

const AccessRoleHeader: FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // fetch in the header component
    // to prevent modifying grafana code
    dispatch(fetchRolesAction());
    dispatch(fetchUsersListAction());
  }, [dispatch]);

  return (
    <th>
      <HorizontalGroup>
        <span data-testid="access-role-header">{Messages.header}</span>
        <Tooltip content={Messages.tooltip}>
          <Icon name="info-circle" />
        </Tooltip>
      </HorizontalGroup>
    </th>
  );
};

export default AccessRoleHeader;

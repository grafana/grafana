import React, { FC, useEffect, useMemo, useState } from 'react';

import { AppEvents, SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { assignRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { getAccessRoles, getUsersInfo } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { OrgUser, UserDTO, useSelector } from 'app/types';

import { Messages } from './AccessRoleCell.messages';
import { idsToOptions, toOptions } from './AccessRoleCell.utils';

interface AccessRoleCellProps {
  user: OrgUser | UserDTO;
}

const AccessRoleCell: FC<React.PropsWithChildren<AccessRoleCellProps>> = ({ user }) => {
  const userId = useMemo(() => ('userId' in user ? user.userId : user.id), [user]);
  const dispatch = useAppDispatch();
  const { roles, isLoading: rolesLoading } = useSelector(getAccessRoles);
  const { usersMap, isLoading: usersLoading } = useSelector(getUsersInfo);
  const roleIds = useMemo<number[]>(() => usersMap[userId]?.roleIds || [], [usersMap, userId]);
  const options = useMemo<Array<SelectableValue<number>>>(() => toOptions(roles), [roles]);
  const [value, setValue] = useState<Array<SelectableValue<number>>>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setValue(idsToOptions(roleIds, roles));
  }, [roles, roleIds]);

  const handleChange = async (selected: SelectableValue<number>) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const roleIds = selected as Array<SelectableValue<number>>;
    setValue(roleIds);
    // value will always be defined
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const ids = roleIds.map((v) => v.value as number);
    const payload = {
      roleIds: ids,
      userId: userId,
    };
    await dispatch(assignRoleAction(payload));
    appEvents.emit(AppEvents.alertSuccess, [Messages.success.title(user.name || user.login), Messages.success.body]);
  };

  return (
    <td>
      <Select
        aria-label={Messages.label}
        isMulti={isOpen || value.length !== 1}
        value={value}
        onChange={handleChange}
        options={options}
        isClearable={false}
        closeMenuOnSelect={false}
        isLoading={rolesLoading || usersLoading}
        onOpenMenu={() => setIsOpen(true)}
        onCloseMenu={() => setIsOpen(false)}
      />
    </td>
  );
};

export default AccessRoleCell;

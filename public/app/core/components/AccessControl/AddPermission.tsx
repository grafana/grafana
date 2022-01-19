import React, { useEffect, useMemo, useState } from 'react';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { TeamPicker } from 'app/core/components/Select/TeamPicker';
import { Button, Form, HorizontalGroup, Select } from '@grafana/ui';
import { OrgRole } from 'app/types/acl';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { Assignments, PermissionTarget, SetPermission } from './types';

export interface Props {
  title?: string;
  permissions: string[];
  assignments: Assignments;
  canListUsers: boolean;
  onCancel: () => void;
  onAdd: (state: SetPermission) => void;
}

export const AddPermission = ({
  title = 'Add Permission For',
  permissions,
  assignments,
  canListUsers,
  onAdd,
  onCancel,
}: Props) => {
  const [target, setPermissionTarget] = useState<PermissionTarget>(PermissionTarget.User);
  const [teamId, setTeamId] = useState(0);
  const [userId, setUserId] = useState(0);
  const [builtInRole, setBuiltinRole] = useState('');
  const [permission, setPermission] = useState('');

  const targetOptions = useMemo(() => {
    const options = [];
    if (assignments.users && canListUsers) {
      options.push({ value: PermissionTarget.User, label: 'User', isDisabled: false });
    }
    if (assignments.teams) {
      options.push({ value: PermissionTarget.Team, label: 'Team' });
    }
    if (assignments.builtInRoles) {
      options.push({ value: PermissionTarget.BuiltInRole, label: 'Role' });
    }
    return options;
  }, [assignments, canListUsers]);

  useEffect(() => {
    if (permissions.length > 0) {
      setPermission(permissions[0]);
    }
  }, [permissions]);

  const isValid = () =>
    (target === PermissionTarget.Team && teamId > 0) ||
    (target === PermissionTarget.User && userId > 0) ||
    (PermissionTarget.BuiltInRole && OrgRole.hasOwnProperty(builtInRole));

  return (
    <div className="cta-form" aria-label="Permissions slider">
      <CloseButton onClick={onCancel} />
      <h5>{title}</h5>
      <Form
        name="addPermission"
        maxWidth="none"
        onSubmit={() => onAdd({ userId, teamId, builtInRole, permission, target })}
      >
        {() => (
          <HorizontalGroup>
            <Select
              aria-label="Role to add new permission to"
              value={target}
              options={targetOptions}
              onChange={(v) => setPermissionTarget(v.value!)}
              menuShouldPortal
            />

            {target === PermissionTarget.User && (
              <UserPicker onSelected={(u) => setUserId(u.value || 0)} className={'width-20'} />
            )}

            {target === PermissionTarget.Team && (
              <TeamPicker onSelected={(t) => setTeamId(t.value?.id || 0)} className={'width-20'} />
            )}

            {target === PermissionTarget.BuiltInRole && (
              <Select
                aria-label={'Built-in role picker'}
                menuShouldPortal
                options={Object.values(OrgRole).map((r) => ({ value: r, label: r }))}
                onChange={(r) => setBuiltinRole(r.value || '')}
                width={40}
              />
            )}

            <Select
              width={25}
              menuShouldPortal
              value={permissions.find((p) => p === permission)}
              options={permissions.map((p) => ({ label: p, value: p }))}
              onChange={(v) => setPermission(v.value || '')}
            />
            <Button type="submit" disabled={!isValid()}>
              Save
            </Button>
          </HorizontalGroup>
        )}
      </Form>
    </div>
  );
};

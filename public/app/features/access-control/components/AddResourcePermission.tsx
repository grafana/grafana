import React, { useState, useEffect, useMemo } from 'react';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { TeamPicker } from 'app/core/components/Select/TeamPicker';
import { Button, Form, HorizontalGroup, Select } from '@grafana/ui';
import { OrgRole } from 'app/types/acl';
import { Assignments, AclTarget, SetResourcePermission } from '../types';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';

const roles = [OrgRole.Admin, OrgRole.Editor, OrgRole.Viewer];

export interface Props {
  permissions: string[];
  assignments: Assignments;
  canListUsers: boolean;
  onCancel: () => void;
  onAdd: (state: SetResourcePermission) => void;
}

export const AddResourcePermission = ({ permissions, assignments, canListUsers, onAdd, onCancel }: Props) => {
  const pickerClassName = 'width-20';

  const [target, setTarget] = useState<AclTarget>(AclTarget.User);
  const [teamId, setTeamId] = useState<number>(0);
  const [userId, setUserId] = useState<number>(0);
  const [builtInRole, setBuiltinRole] = useState<string>('');
  const [permission, setPermission] = useState<string>('');

  const targetOptions = useMemo(() => {
    const options = [] as any;
    if (assignments.users && canListUsers) {
      options.push({ value: AclTarget.User, label: 'User', isDisabled: false });
    }
    if (assignments.teams) {
      options.push({ value: AclTarget.Team, label: 'Team' });
    }
    if (assignments.builtinRoles) {
      options.push({ value: AclTarget.BuiltInRole, label: 'Role' });
    }
    return options;
  }, [assignments, canListUsers]);

  useEffect(() => {
    if (permissions.length > 0) {
      setPermission(permissions[0]);
    }
  }, [permissions]);

  const isValid = () => {
    switch (target) {
      case AclTarget.Team:
        return teamId > 0;
      case AclTarget.User:
        return userId > 0;
      case AclTarget.BuiltInRole:
        return roles.some((r) => r === builtInRole);
    }
    return true;
  };

  return (
    <div className="cta-form" aria-label="Permissions slider">
      <CloseButton onClick={onCancel} />
      <h5>Add Permission For</h5>
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
              onChange={(v) => setTarget(v.value as AclTarget)}
              menuShouldPortal
            />

            {target === AclTarget.User && (
              <UserPicker onSelected={(u) => setUserId(u.value || 0)} className={pickerClassName} />
            )}

            {target === AclTarget.Team && (
              <TeamPicker onSelected={(t) => setTeamId(t.value?.id || 0)} className={pickerClassName} />
            )}

            {target === AclTarget.BuiltInRole && (
              <Select
                aria-label={'Built-in role picker'}
                menuShouldPortal
                options={roles.map((r) => ({ value: r, label: r }))}
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

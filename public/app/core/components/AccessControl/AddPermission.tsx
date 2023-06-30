import React, { useEffect, useMemo, useState } from 'react';

import { Stack } from '@grafana/experimental';
import { Button, Form, Select } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { TeamPicker } from 'app/core/components/Select/TeamPicker';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { Trans, t } from 'app/core/internationalization';
import { OrgRole } from 'app/types/acl';

import { Assignments, PermissionTarget, SetPermission } from './types';

export interface Props {
  title?: string;
  permissions: string[];
  assignments: Assignments;
  onCancel: () => void;
  onAdd: (state: SetPermission) => void;
}

export const AddPermission = ({
  title = t('access-control.add-permission.title', 'Add permission for'),
  permissions,
  assignments,
  onAdd,
  onCancel,
}: Props) => {
  const [target, setPermissionTarget] = useState<PermissionTarget>(PermissionTarget.None);
  const [teamId, setTeamId] = useState(0);
  const [userId, setUserId] = useState(0);
  const [builtInRole, setBuiltinRole] = useState('');
  const [permission, setPermission] = useState('');

  const targetOptions = useMemo(() => {
    const options = [];
    if (assignments.users) {
      options.push({ value: PermissionTarget.User, label: t('access-control.add-permission.user-label', 'User') });
    }
    if (assignments.teams) {
      options.push({ value: PermissionTarget.Team, label: t('access-control.add-permission.team-label', 'Team') });
    }
    if (assignments.builtInRoles) {
      options.push({
        value: PermissionTarget.BuiltInRole,
        label: t('access-control.add-permission.role-label', 'Role'),
      });
    }
    return options;
  }, [assignments]);

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
          <Stack gap={1} direction="row">
            <Select
              aria-label="Role to add new permission to"
              value={target}
              options={targetOptions}
              onChange={(v) => setPermissionTarget(v.value!)}
              disabled={targetOptions.length === 0}
              width="auto"
            />

            {target === PermissionTarget.User && <UserPicker onSelected={(u) => setUserId(u?.value || 0)} />}

            {target === PermissionTarget.Team && <TeamPicker onSelected={(t) => setTeamId(t.value?.id || 0)} />}

            {target === PermissionTarget.BuiltInRole && (
              <Select
                aria-label={'Built-in role picker'}
                options={Object.values(OrgRole).map((r) => ({ value: r, label: r }))}
                onChange={(r) => setBuiltinRole(r.value || '')}
                width="auto"
              />
            )}

            <Select
              aria-label="Permission Level"
              width="auto"
              value={permissions.find((p) => p === permission)}
              options={permissions.map((p) => ({ label: p, value: p }))}
              onChange={(v) => setPermission(v.value || '')}
            />
            <Button type="submit" disabled={!isValid()}>
              <Trans i18nKey="access-control.add-permissions.save">Save</Trans>
            </Button>
          </Stack>
        )}
      </Form>
    </div>
  );
};

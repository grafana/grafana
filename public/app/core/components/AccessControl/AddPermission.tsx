import { useEffect, useMemo, useState } from 'react';

import { Button, Select, Stack } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { ServiceAccountPicker } from 'app/core/components/Select/ServiceAccountPicker';
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
  const [teamUid, setTeamUid] = useState('');
  const [userUid, setUserUid] = useState('');
  const [builtInRole, setBuiltinRole] = useState('');
  const [permission, setPermission] = useState('');

  const targetOptions = useMemo(() => {
    const options = [];
    if (assignments.users) {
      options.push({ value: PermissionTarget.User, label: t('access-control.add-permission.user-label', 'User') });
    }
    if (assignments.serviceAccounts) {
      options.push({
        value: PermissionTarget.ServiceAccount,
        label: t('access-control.add-permission.serviceaccount-label', 'Service Account'),
      });
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
    (target === PermissionTarget.Team && teamUid) ||
    (target === PermissionTarget.User && userUid) ||
    (target === PermissionTarget.ServiceAccount && userUid) ||
    (PermissionTarget.BuiltInRole && OrgRole.hasOwnProperty(builtInRole));

  return (
    <div className="cta-form" aria-label="Permissions slider">
      <CloseButton onClick={onCancel} />
      <h5>{title}</h5>

      <form
        name="addPermission"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd({ userUid, teamUid, builtInRole, permission, target });
        }}
      >
        <Stack gap={1} direction="row">
          <Select
            aria-label="Role to add new permission to"
            value={target}
            options={targetOptions}
            onChange={(v) => setPermissionTarget(v.value!)}
            disabled={targetOptions.length === 0}
            width="auto"
          />

          {target === PermissionTarget.User && <UserPicker onSelected={(u) => setUserUid(u?.value?.uid || '')} />}

          {target === PermissionTarget.ServiceAccount && (
            <ServiceAccountPicker onSelected={(u) => setUserUid(u?.value?.uid || '')} />
          )}

          {target === PermissionTarget.Team && <TeamPicker onSelected={(t) => setTeamUid(t.value?.uid || '')} />}

          {target === PermissionTarget.BuiltInRole && (
            <Select
              aria-label={'Built-in role picker'}
              options={Object.values(OrgRole)
                .filter((r) => r !== OrgRole.None)
                .map((r) => ({ value: r, label: r }))}
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
      </form>
    </div>
  );
};

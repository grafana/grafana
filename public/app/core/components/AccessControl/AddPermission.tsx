import React, { useContext, useEffect, useMemo, useState } from 'react';

import { config } from '@grafana/runtime';
import { Button, Form, Select, Stack } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { ServiceAccountPicker } from 'app/core/components/Select/ServiceAccountPicker';
import { TeamPicker } from 'app/core/components/Select/TeamPicker';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { t, Trans } from 'app/core/internationalization';
import { OrgRole } from 'app/types/acl';

import { ActionGrid } from './ActionGrid';
import { ResourceDescriptionCtx } from './ResourceDescription';
import { CUSTOM_RESOURCE_PERMISSION, CUSTOM_RESOURCE_PERMISSION_DISPLAY } from './ResourcePermissions';
import { PermissionTarget, SetPermission } from './types';

export interface Props {
  title?: string;
  onCancel: () => void;
  onAdd: (state: SetPermission) => void;
}

export const AddPermission = ({
  title = t('access-control.add-permission.title', 'Add permission for'),
  onAdd,
  onCancel,
}: Props) => {
  const [target, setPermissionTarget] = useState<PermissionTarget>(PermissionTarget.None);
  const [teamId, setTeamId] = useState(0);
  const [userId, setUserId] = useState(0);
  const [builtInRole, setBuiltinRole] = useState('');
  const [permission, setPermission] = useState('');
  const [fineGrainedActions, setFineGrainedActions] = useState<string[]>([]);
  const { resource, assignments, permissions } = useContext(ResourceDescriptionCtx);
  const customResourceActionsEnabled = resource === 'folders' && config.featureToggles.customResourcePermissionActions;

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

  const isValid = () => {
    const targetSelected =
      (target === PermissionTarget.Team && teamId > 0) ||
      (target === PermissionTarget.User && userId > 0) ||
      (target === PermissionTarget.ServiceAccount && userId > 0) ||
      (PermissionTarget.BuiltInRole && OrgRole.hasOwnProperty(builtInRole));

    if (permission === CUSTOM_RESOURCE_PERMISSION) {
      return targetSelected && fineGrainedActions.length > 0;
    }

    return targetSelected;
  };

  const permissionOptions = permissions.map((p) => ({ label: p, value: p }));
  if (customResourceActionsEnabled) {
    permissionOptions.push({ label: CUSTOM_RESOURCE_PERMISSION_DISPLAY, value: CUSTOM_RESOURCE_PERMISSION });
  }

  return (
    <div className="cta-form" aria-label="Permissions slider">
      <CloseButton onClick={onCancel} />
      <h5>{title}</h5>

      <Form
        name="addPermission"
        maxWidth="none"
        onSubmit={() => onAdd({ userId, teamId, builtInRole, permission, target, actions: fineGrainedActions })}
      >
        {() => (
          <Stack gap={1} direction="column">
            <Select
              aria-label="Role to add new permission to"
              value={target}
              options={targetOptions}
              onChange={(v) => setPermissionTarget(v.value!)}
              disabled={targetOptions.length === 0}
              width="auto"
            />

            {target === PermissionTarget.User && <UserPicker onSelected={(u) => setUserId(u?.value || 0)} />}

            {target === PermissionTarget.ServiceAccount && (
              <ServiceAccountPicker onSelected={(u) => setUserId(u?.value || 0)} />
            )}

            {target === PermissionTarget.Team && <TeamPicker onSelected={(t) => setTeamId(t.value?.id || 0)} />}

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
              options={permissionOptions}
              onChange={(v) => setPermission(v.value || '')}
            />

            {customResourceActionsEnabled && permission === CUSTOM_RESOURCE_PERMISSION && (
              <ActionGrid selectedActions={fineGrainedActions} setSelectedActions={setFineGrainedActions} />
            )}

            <Button type="submit" disabled={!isValid()}>
              <Trans i18nKey="access-control.add-permissions.save">Save</Trans>
            </Button>
          </Stack>
        )}
      </Form>
    </div>
  );
};

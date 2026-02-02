import { FC, useEffect, useState } from 'react';

import { Button, Drawer } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { BMCRole } from 'app/types';

import { loadRoleDetails } from '../roles/state/actions';

import { PermissionResourceGroupList } from './PermissionResourceGroupList';
import { translatePermissions } from './permission-translations';
import { getPermissions, updatePermissions } from './state/apis';
import { Permission } from './state/types';

type Props = {
  role: BMCRole;
  onDismiss: () => void;
};

export const PermissionListDrawer: FC<Props> = ({ onDismiss, role }) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleDetails, setRoleDetails] = useState<BMCRole | undefined>(role);

  const load = () => {
    Promise.all([
      getPermissions(role.id!).then((perms: Permission[]) => {
        const permsWithTranslations = translatePermissions(perms);
        setPermissions(permsWithTranslations);
      }),
      !role.name && loadRoleDetails(role.id!).then(setRoleDetails),
    ]);
  };

  const update = () => {
    updatePermissions(roleDetails, permissions).then(onDismiss);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  return (
    <Drawer
      title={`${roleDetails ? roleDetails.name + ' - ' + t('bmc.rbac.permissions.title', 'Permissions') : t('bmc.common.loading', 'Loading...')}`}
      onClose={onDismiss}
      closeOnMaskClick={false}
      width={'40%'}
      subtitle={t('bmc.rbac.permissions.list', 'List of permissions')}
      expandable
      scrollableContent={false}
    >
      {roleDetails ? (
        <>
          <PermissionResourceGroupList
            permissions={permissions}
            canEdit={!roleDetails.systemRole}
            onChange={(name, status) => {
              const index = permissions.findIndex((p) => p.name === name);
              if (index === -1) {
                return;
              }
              const perms = [...permissions];
              perms[index].status = status;
              setPermissions(perms);
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'end',
              marginTop: '15px',
            }}
          >
            <Button
              size="md"
              style={{ marginRight: '15px' }}
              variant={'primary'}
              fill="solid"
              onClick={update}
              disabled={role.systemRole}
            >
              <Trans i18nKey="bmc.common.save">Save</Trans>
            </Button>
            <Button size="md" variant="secondary" fill="solid" onClick={onDismiss}>
              <Trans i18nKey="bmc.common.cancel">Cancel</Trans>
            </Button>
          </div>
        </>
      ) : null}
    </Drawer>
  );
};

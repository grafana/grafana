import { useRef, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, ConfirmModal, Stack } from '@grafana/ui';
import {
  useAdminDeleteUserMutation,
  useAdminDisableUserMutation,
  useAdminEnableUserMutation,
} from 'app/api/clients/legacy';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type UserDTO } from 'app/types/user';

import { type RunAction } from './hooks';

export function AccountActions({ user, run }: { user: UserDTO; run: RunAction }) {
  const [deleteUser] = useAdminDeleteUserMutation();
  const [disableUser] = useAdminDisableUserMutation();
  const [enableUser] = useAdminEnableUserMutation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const disableButton = useRef<HTMLButtonElement>(null);
  const canDelete = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDelete, user);
  const canDisable = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDisable, user);
  const canEnable = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersEnable, user);

  const onDelete = async () => {
    setShowDeleteModal(false);
    if (await run(deleteUser({ userId: user.uid }).unwrap())) {
      locationService.push('/admin/users');
    }
  };

  return (
    <Stack gap={2}>
      {canDelete && (
        <>
          <Button variant="destructive" onClick={() => setShowDeleteModal(true)} ref={deleteButton}>
            <Trans i18nKey="admin.user-profile.delete-button">Delete user</Trans>
          </Button>
          <ConfirmModal
            isOpen={showDeleteModal}
            title={t('admin.user-profile.title-delete-user', 'Delete user')}
            body={t('admin.user-profile.body-delete', 'Are you sure you want to delete this user?')}
            confirmText={t('admin.user-profile.confirmText-delete-user', 'Delete user')}
            onConfirm={onDelete}
            onDismiss={() => {
              setShowDeleteModal(false);
              deleteButton.current?.focus();
            }}
          />
        </>
      )}
      {user.isDisabled && canEnable && (
        <Button variant="secondary" onClick={() => run(enableUser({ userId: user.uid }).unwrap())}>
          <Trans i18nKey="admin.user-profile.enable-button">Enable user</Trans>
        </Button>
      )}
      {!user.isDisabled && canDisable && (
        <>
          <Button variant="secondary" onClick={() => setShowDisableModal(true)} ref={disableButton}>
            <Trans i18nKey="admin.user-profile.disable-button">Disable user</Trans>
          </Button>
          <ConfirmModal
            isOpen={showDisableModal}
            title={t('admin.user-profile.title-disable-user', 'Disable user')}
            body={t('admin.user-profile.body-disable', 'Are you sure you want to disable this user?')}
            confirmText={t('admin.user-profile.confirmText-disable-user', 'Disable user')}
            onConfirm={() => {
              setShowDisableModal(false);
              run(disableUser({ userId: user.uid }).unwrap());
            }}
            onDismiss={() => {
              setShowDisableModal(false);
              disableButton.current?.focus();
            }}
          />
        </>
      )}
    </Stack>
  );
}

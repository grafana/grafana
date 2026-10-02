import { useRef, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, ConfirmModal, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type UserDTO } from 'app/types/user';

interface Props {
  user: UserDTO;
  onUserDelete: (userUid: string) => void;
  onUserDisable: (userUid: string) => void;
  onUserEnable: (userUid: string) => void;
}

export function UserAccountActions({ user, onUserDelete, onUserDisable, onUserEnable }: Props) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const deleteUserRef = useRef<HTMLButtonElement | null>(null);
  const disableUserRef = useRef<HTMLButtonElement | null>(null);
  const canDelete = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDelete, user);
  const canDisable = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDisable, user);
  const canEnable = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersEnable, user);

  return (
    <Stack gap={2}>
      {canDelete && (
        <>
          <Button variant="destructive" onClick={() => setShowDeleteModal(true)} ref={deleteUserRef}>
            <Trans i18nKey="admin.user-profile.delete-button">Delete user</Trans>
          </Button>
          <ConfirmModal
            isOpen={showDeleteModal}
            title={t('admin.user-profile.title-delete-user', 'Delete user')}
            body={t('admin.user-profile.body-delete', 'Are you sure you want to delete this user?')}
            confirmText={t('admin.user-profile.confirmText-delete-user', 'Delete user')}
            onConfirm={() => onUserDelete(user.uid)}
            onDismiss={() => {
              setShowDeleteModal(false);
              deleteUserRef.current?.focus();
            }}
          />
        </>
      )}
      {user.isDisabled && canEnable && (
        <Button variant="secondary" onClick={() => onUserEnable(user.uid)}>
          <Trans i18nKey="admin.user-profile.enable-button">Enable user</Trans>
        </Button>
      )}
      {!user.isDisabled && canDisable && (
        <>
          <Button variant="secondary" onClick={() => setShowDisableModal(true)} ref={disableUserRef}>
            <Trans i18nKey="admin.user-profile.disable-button">Disable user</Trans>
          </Button>
          <ConfirmModal
            isOpen={showDisableModal}
            title={t('admin.user-profile.title-disable-user', 'Disable user')}
            body={t('admin.user-profile.body-disable', 'Are you sure you want to disable this user?')}
            confirmText={t('admin.user-profile.confirmText-disable-user', 'Disable user')}
            onConfirm={() => onUserDisable(user.uid)}
            onDismiss={() => {
              setShowDisableModal(false);
              disableUserRef.current?.focus();
            }}
          />
        </>
      )}
    </Stack>
  );
}

import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, ConfirmModal, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { UserDTO } from 'app/types/user';

interface Props {
  user: UserDTO;
  onUserDelete: (userUid: string) => void;
}

export const UserInformationPage = ({ user, onUserDelete }: Props) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const showDeleteUserModal = (show: boolean) => () => {
    setShowDeleteModal(show);
  };

  const handleUserDelete = () => {
    onUserDelete(user.uid);
  };

  let authSource = user.authLabels?.length ? user.authLabels[0] : undefined;
  if (user.isProvisioned) {
    authSource = 'SCIM';
  }
  const lockMessage = authSource ? `Synced via ${authSource}` : '';

  // Only show delete button if user is NOT provisioned and has permission
  const canDelete =
    !user.isProvisioned && contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDelete, user);

  const labelClass = cx(
    'width-16',
    css({
      fontWeight: 500,
    })
  );

  const lockMessageClass = css({
    fontStyle: 'italic',
    marginRight: '0.6rem',
  });

  return (
    <div>
      <Stack direction="column" gap={1.5}>
        <div>
          <table className="filter-table form-inline">
            <tbody>
              <tr>
                <td className={labelClass}>
                  <Trans i18nKey="admin.user-information.label-numerical-identifier">Numerical identifier</Trans>
                </td>
                <td className="width-25" colSpan={2}>
                  {user.id}
                </td>
                <td></td>
              </tr>
              <tr>
                <td className={labelClass}>
                  <Trans i18nKey="admin.user-information.label-username">Username</Trans>
                </td>
                <td className="width-25" colSpan={2}>
                  {user.login}
                </td>
                <td>
                  {lockMessage && <span className={lockMessageClass}>{lockMessage}</span>}
                </td>
              </tr>
              <tr>
                <td className={labelClass}>
                  <Trans i18nKey="admin.user-information.label-display-name">Display name</Trans>
                </td>
                <td className="width-25" colSpan={2}>
                  {user.name}
                </td>
                <td>
                  {lockMessage && <span className={lockMessageClass}>{lockMessage}</span>}
                </td>
              </tr>
              <tr>
                <td className={labelClass}>
                  <Trans i18nKey="admin.user-information.label-email-address">Email address</Trans>
                </td>
                <td className="width-25" colSpan={2}>
                  {user.email}
                </td>
                <td>
                  {lockMessage && <span className={lockMessageClass}>{lockMessage}</span>}
                </td>
              </tr>
              {user.authLabels && user.authLabels.length > 0 && (
                <tr>
                  <td className={labelClass}>
                    <Trans i18nKey="admin.user-information.label-authentication">Authentication</Trans>
                  </td>
                  <td className="width-25" colSpan={2}>
                    {user.authLabels.join(', ')}
                  </td>
                  <td></td>
                </tr>
              )}
              {(user.isProvisioned || user.isExternallySynced) && (
                <tr>
                  <td className={labelClass}>
                    <Trans i18nKey="admin.user-information.label-provisioning-status">Provisioning Status</Trans>
                  </td>
                  <td className="width-25" colSpan={2}>
                    {user.isProvisioned && (
                      <Trans i18nKey="admin.user-information.provisioned">Provisioned</Trans>
                    )}
                    {user.isExternallySynced && !user.isProvisioned && (
                      <Trans i18nKey="admin.user-information.externally-synced">Externally Synced</Trans>
                    )}
                  </td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {canDelete && (
          <Stack gap={2}>
            <Button variant="destructive" onClick={showDeleteUserModal(true)}>
              <Trans i18nKey="admin.user-information.delete-button">Delete user</Trans>
            </Button>
            <ConfirmModal
              isOpen={showDeleteModal}
              title={t('admin.user-information.title-delete-user', 'Delete user')}
              body={t('admin.user-information.body-delete', 'Are you sure you want to delete this user?')}
              confirmText={t('admin.user-information.confirmText-delete-user', 'Delete user')}
              onConfirm={handleUserDelete}
              onDismiss={showDeleteUserModal(false)}
            />
          </Stack>
        )}
      </Stack>
    </div>
  );
};

import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Button, Modal, ModalsController, useStyles2 } from '@grafana/ui/src';
import { SessionUser } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

import { useRevokeAllAccessMutation } from '../../dashboard/api/publicDashboardApi';

const DeleteUserModal = ({ user, hideModal }: { user: SessionUser; hideModal: () => void }) => {
  const [revokeAllAccess] = useRevokeAllAccessMutation();
  const styles = useStyles2(getStyles);

  const onRevokeAccessClick = () => {
    revokeAllAccess({ email: user.email });
    hideModal();
  };

  return (
    <Modal className={styles.modal} isOpen title="Revoke access" onDismiss={hideModal}>
      <p className={styles.description}>Are you sure you want to revoke access for {user.email}?</p>
      <p className={styles.description}>
        This action will immediately revoke {user.email}&apos;s access to all public dashboards.
      </p>
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={hideModal} fill="outline">
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={onRevokeAccessClick}>
          Revoke access
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export const DeleteUserModalButton = ({ user }: { user: SessionUser }) => (
  <ModalsController>
    {({ showModal, hideModal }) => (
      <Button
        size="sm"
        variant="destructive"
        onClick={() => showModal(DeleteUserModal, { user, hideModal })}
        icon="times"
        aria-label="Delete user"
        title="Delete user"
      />
    )}
  </ModalsController>
);

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 500px;
  `,
  description: css`
    font-size: ${theme.typography.body.fontSize};
    margin: 0;
  `,
});

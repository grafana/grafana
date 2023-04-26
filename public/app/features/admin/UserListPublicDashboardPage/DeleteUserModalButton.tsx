import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Button, Modal, ModalsController, useStyles2 } from '@grafana/ui/src';
import { SessionUser } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

const DeleteUserModal = ({ user, onDismiss }: { user: SessionUser; onDismiss: () => void }) => {
  const styles = useStyles2(getStyles);

  return (
    <Modal className={styles.modal} isOpen title="Delete" onDismiss={onDismiss}>
      <p className={styles.description}>
        The user {user.email} is currently present in {user.totalDashboards} public dashboard(s). If you wish to remove
        this user, please navigate to the settings of the corresponding public dashboard.
      </p>
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={onDismiss} fill="outline">
          Close
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
        onClick={() => showModal(DeleteUserModal, { user, onDismiss: hideModal })}
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

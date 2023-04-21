import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Button, ConfirmModal, ModalsController, useStyles2 } from '@grafana/ui/src';
import { SessionUser } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

const DeleteUserModal = ({ user, onDismiss }: { user: SessionUser; onDismiss: () => void }) => {
  const styles = useStyles2(getStyles);

  const body = (
    <p className={styles.description}>
      The user {user.email} is currently present in {user.dashboards?.length} public dashboards. If you wish to remove
      this user, please navigate to the settings of the corresponding public dashboard.
    </p>
  );

  return (
    <ConfirmModal
      modalClass={styles.modal}
      body={body}
      confirmText="Delete"
      title="Delete"
      onDismiss={onDismiss}
      isOpen
      onConfirm={onDismiss}
    />
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
  `,
});

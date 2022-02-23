import React from 'react';
import { css } from '@emotion/css';
import { Modal, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

import { CommentManager } from 'app/features/comments/CommentManager';
import { DashboardModel } from '../../state/DashboardModel';

type Props = {
  dashboard: DashboardModel;
  onDismiss: () => void;
};

export const DashboardCommentsModal = ({ dashboard, onDismiss }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Modal isOpen={true} title="Dashboard comments" icon="save" onDismiss={onDismiss} className={styles.modal}>
      <CommentManager objectType={'dashboard'} objectId={dashboard.uid} />
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 500px;
    height: 60vh;
  `,
});

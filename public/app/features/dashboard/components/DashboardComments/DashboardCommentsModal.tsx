import React from 'react';
import { Modal } from '@grafana/ui';
import { css } from '@emotion/css';

import { CommentManager } from 'app/features/chat/CommentManager';
import { DashboardModel } from '../../state/DashboardModel';

type Props = {
  dashboard: DashboardModel;
  onDismiss: () => void;
};

export function DashboardCommentsModal({ dashboard, onDismiss }: Props) {
  return (
    <Modal
      isOpen={true}
      title="Dashboard comments"
      icon="save"
      onDismiss={onDismiss}
      className={css`
        width: 500px;
        height: 60vh;
      `}
    >
      <CommentManager contentTypeId={2} objectId={dashboard.uid} />
    </Modal>
  );
}

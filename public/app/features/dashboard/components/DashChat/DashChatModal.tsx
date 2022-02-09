import React from 'react';
import { Modal } from '@grafana/ui';
import { css } from '@emotion/css';
import { ChatDashboardModalProps } from './types';
import { Chat } from 'app/features/chat/Chat';

export const DashboardChatModal: React.FC<ChatDashboardModalProps> = ({ dashboard, onDismiss }) => {
  return (
    <>
      <Modal
        isOpen={true}
        title="Dashboard discussions"
        icon="save"
        onDismiss={onDismiss}
        className={css`
          width: 500px;
        `}
      >
        <Chat contentTypeId={2} objectId={dashboard.uid} />
      </Modal>
    </>
  );
};

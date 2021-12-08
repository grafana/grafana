import React from 'react';
import { ChatDashboardModalProps } from './types';
import { DashboardChatModal } from './DashChatModal';

export const DashboardChatModalProxy: React.FC<ChatDashboardModalProps> = ({ dashboard, onDismiss, onSaveSuccess }) => {
  const modalProps = {
    dashboard,
    onDismiss,
    onSaveSuccess,
  };

  return (
    <>
      <DashboardChatModal {...modalProps} />
    </>
  );
};

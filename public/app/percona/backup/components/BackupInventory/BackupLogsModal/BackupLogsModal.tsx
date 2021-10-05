import React, { FC } from 'react';
import { Modal } from '@percona/platform-core';
import { BackupLogsModalProps } from './BackupLogsModal.types';
import { ChunkedLogsViewer } from '../../ChunkedLogsViewer/ChunkedLogsViewer';

export const BackupLogsModal: FC<BackupLogsModalProps> = ({ title, isVisible, onClose, getLogChunks }) => {
  return (
    <Modal title={title} isVisible={isVisible} onClose={onClose}>
      <ChunkedLogsViewer getLogChunks={getLogChunks} />
    </Modal>
  );
};

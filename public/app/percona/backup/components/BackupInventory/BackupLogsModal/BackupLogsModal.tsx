import { Modal } from '@percona/platform-core';
import React, { FC } from 'react';

import { ChunkedLogsViewer } from '../../ChunkedLogsViewer/ChunkedLogsViewer';

import { BackupLogsModalProps } from './BackupLogsModal.types';

export const BackupLogsModal: FC<BackupLogsModalProps> = ({ title, isVisible, onClose, getLogChunks }) => {
  return (
    <Modal title={title} isVisible={isVisible} onClose={onClose}>
      <ChunkedLogsViewer getLogChunks={getLogChunks} />
    </Modal>
  );
};

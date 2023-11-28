import React, { FC } from 'react';

import { Modal } from 'app/percona/shared/components/Elements/Modal';

import { ChunkedLogsViewer } from '../../ChunkedLogsViewer/ChunkedLogsViewer';

import { BackupLogsModalProps } from './BackupLogsModal.types';

export const BackupLogsModal: FC<React.PropsWithChildren<BackupLogsModalProps>> = ({ title, isVisible, onClose, getLogChunks }) => {
  return (
    <Modal title={title} isVisible={isVisible} onClose={onClose}>
      <ChunkedLogsViewer getLogChunks={getLogChunks} />
    </Modal>
  );
};

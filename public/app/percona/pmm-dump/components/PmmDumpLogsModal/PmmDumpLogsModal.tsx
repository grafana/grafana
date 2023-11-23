import React, { FC } from 'react';

import { ChunkedLogsViewer } from 'app/percona/backup/components/ChunkedLogsViewer/ChunkedLogsViewer';
import { Modal } from 'app/percona/shared/components/Elements/Modal';

import { PmmDumpModalProps } from './PmmDumpLogsModal.types';

export const PmmDumpLogsModal: FC<PmmDumpModalProps> = ({ title, isVisible, onClose, getLogChunks }) => {
  return (
    <Modal title={title} isVisible={isVisible} onClose={onClose}>
      <ChunkedLogsViewer getLogChunks={getLogChunks} />
    </Modal>
  );
};

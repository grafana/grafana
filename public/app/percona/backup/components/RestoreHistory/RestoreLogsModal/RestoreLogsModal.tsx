import { Modal } from '@percona/platform-core';
import React, { FC } from 'react';

import { ChunkedLogsViewer } from '../../ChunkedLogsViewer/ChunkedLogsViewer';

import { RestoreLogsModalProps } from './RestoreLogsModal.types';

export const RestoreLogsModal: FC<RestoreLogsModalProps> = ({ title, isVisible, onClose, getLogChunks }) => (
  <Modal title={title} isVisible={isVisible} onClose={onClose}>
    <ChunkedLogsViewer getLogChunks={getLogChunks} />
  </Modal>
);

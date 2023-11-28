import React, { FC } from 'react';

import { Modal } from 'app/percona/shared/components/Elements/Modal';

import { ChunkedLogsViewer } from '../../ChunkedLogsViewer/ChunkedLogsViewer';

import { RestoreLogsModalProps } from './RestoreLogsModal.types';

export const RestoreLogsModal: FC<React.PropsWithChildren<RestoreLogsModalProps>> = ({ title, isVisible, onClose, getLogChunks }) => (
  <Modal title={title} isVisible={isVisible} onClose={onClose}>
    <ChunkedLogsViewer getLogChunks={getLogChunks} />
  </Modal>
);

import React from 'react';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { ChunkedLogsViewer } from '../../ChunkedLogsViewer/ChunkedLogsViewer';
export const BackupLogsModal = ({ title, isVisible, onClose, getLogChunks }) => {
    return (React.createElement(Modal, { title: title, isVisible: isVisible, onClose: onClose },
        React.createElement(ChunkedLogsViewer, { getLogChunks: getLogChunks })));
};
//# sourceMappingURL=BackupLogsModal.js.map
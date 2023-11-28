import React from 'react';
import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';
import { WarningBlock } from '../../../../shared/components/Elements/WarningBlock/WarningBlock';
import { Messages } from './RemoveStorageLocationModal.messages';
export const RemoveStorageLocationModal = ({ location, isVisible, loading, onDelete, setVisible, }) => {
    const handleDelete = (force = false) => onDelete(location, force);
    return (React.createElement(DeleteModal, { title: Messages.title, loading: loading, isVisible: isVisible, setVisible: setVisible, message: Messages.getDeleteMessage((location === null || location === void 0 ? void 0 : location.name) || ''), onDelete: handleDelete, showForce: true },
        React.createElement(WarningBlock, { message: Messages.deleteLocationWarning })));
};
//# sourceMappingURL=RemoveStorageLocationModal.js.map
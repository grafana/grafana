import React, { useCallback, useMemo, useState } from 'react';
import { Button, Modal } from '@grafana/ui';
/**
 * This hook controls the delete modal for contact points, showing loading and error states when appropriate
 */
export const useDeleteContactPointModal = (handleDelete, isLoading) => {
    const [showModal, setShowModal] = useState(false);
    const [contactPoint, setContactPoint] = useState();
    const [error, setError] = useState();
    const handleDismiss = useCallback(() => {
        if (isLoading) {
            return;
        }
        setContactPoint(undefined);
        setShowModal(false);
        setError(undefined);
    }, [isLoading]);
    const handleShow = useCallback((name) => {
        setContactPoint(name);
        setShowModal(true);
        setError(undefined);
    }, []);
    const handleSubmit = useCallback(() => {
        if (contactPoint) {
            handleDelete(contactPoint)
                .then(() => setShowModal(false))
                .catch(setError);
        }
    }, [handleDelete, contactPoint]);
    const modalElement = useMemo(() => {
        if (error) {
            return React.createElement(ErrorModal, { isOpen: showModal, onDismiss: handleDismiss, error: error });
        }
        return (React.createElement(Modal, { isOpen: showModal, onDismiss: handleDismiss, closeOnBackdropClick: !isLoading, closeOnEscape: !isLoading, title: "Delete contact point" },
            React.createElement("p", null, "Deleting this contact point will permanently remove it."),
            React.createElement("p", null, "Are you sure you want to delete this contact point?"),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { type: "button", variant: "destructive", onClick: handleSubmit, disabled: isLoading }, isLoading ? 'Deleting...' : 'Yes, delete contact point'),
                React.createElement(Button, { type: "button", variant: "secondary", onClick: handleDismiss, disabled: isLoading }, "Cancel"))));
    }, [error, handleDismiss, handleSubmit, isLoading, showModal]);
    return [modalElement, handleShow, handleDismiss];
};
const ErrorModal = ({ isOpen, onDismiss, error }) => (React.createElement(Modal, { isOpen: isOpen, onDismiss: onDismiss, closeOnBackdropClick: true, closeOnEscape: true, title: 'Something went wrong' },
    React.createElement("p", null, "Failed to update your configuration:"),
    React.createElement("p", null,
        React.createElement("code", null, String(error)))));
//# sourceMappingURL=Modals.js.map
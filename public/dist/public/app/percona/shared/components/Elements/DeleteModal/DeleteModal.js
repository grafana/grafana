import React from 'react';
import { withTypes } from 'react-final-form';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { Messages } from './DeleteModal.messages';
import { getStyles } from './DeleteModal.styles';
const { defaultTitle, defaultMessage, defaultConfirm, defaultCancel } = Messages;
const { Form } = withTypes();
export const DeleteModal = ({ title, message, confirm, cancel, isVisible, loading, showForce, forceLabel = Messages.force, initialForceValue = false, cancelButtondataTestId = 'cancel-delete-modal-button', confirmButtondataTestId = 'confirm-delete-modal-button', children, setVisible, onDelete, }) => {
    const styles = useStyles(getStyles);
    return (React.createElement(Modal, { title: title || defaultTitle, isVisible: isVisible, onClose: () => setVisible(false) },
        React.createElement("h4", { className: styles.deleteModalContent }, message || defaultMessage),
        children,
        React.createElement(Form, { onSubmit: ({ force }) => onDelete(force), render: ({ handleSubmit }) => (React.createElement("form", { onSubmit: handleSubmit },
                showForce && React.createElement(CheckboxField, { name: "force", label: forceLabel, initialValue: initialForceValue }),
                React.createElement(HorizontalGroup, { justify: "space-between", spacing: "md" },
                    React.createElement(Button, { variant: "secondary", size: "md", onClick: () => setVisible(false), "data-testid": cancelButtondataTestId }, cancel || defaultCancel),
                    React.createElement(LoaderButton, { type: "submit", loading: loading, variant: "destructive", size: "md", "data-testid": confirmButtondataTestId }, confirm || defaultConfirm)))) })));
};
//# sourceMappingURL=DeleteModal.js.map
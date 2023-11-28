import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { AppEvents } from '@grafana/data';
import { Alert, Button, Checkbox, Modal } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { removeServiceAction } from 'app/percona/shared/core/reducers/services';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { Messages } from './DeleteServiceModal.messages';
const DeleteServiceModal = ({ serviceId, serviceName, isOpen, onCancel, onSuccess }) => {
    const [forceModeActive, setForceActive] = useState(false);
    const dispatch = useAppDispatch();
    const handleDelete = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const params = {
                serviceId: serviceId,
                force: forceModeActive,
            };
            yield dispatch(removeServiceAction(params)).unwrap();
            appEvents.emit(AppEvents.alertSuccess, [Messages.success(serviceName)]);
            setForceActive(false);
            onSuccess();
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
    });
    const handleDismiss = () => {
        setForceActive(false);
        onCancel();
    };
    return (React.createElement(Modal, { isOpen: isOpen, title: Messages.title, onDismiss: handleDismiss },
        React.createElement(Alert, { title: Messages.warning, severity: "warning" }),
        React.createElement("p", { "data-testid": "delete-service-description" }, Messages.description(serviceName)),
        React.createElement("div", null,
            React.createElement(Checkbox, { "data-testid": "delete-service-force-mode", label: Messages.forceMode.label, description: Messages.forceMode.description, checked: forceModeActive, value: forceModeActive, onChange: () => setForceActive((active) => !active) })),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { "data-testid": "delete-service-confirm", onClick: handleDelete }, Messages.submit),
            React.createElement(Button, { "data-testid": "delete-service-cancel", variant: "secondary", onClick: handleDismiss }, Messages.cancel))));
};
export default DeleteServiceModal;
//# sourceMappingURL=DeleteServiceModal.js.map
import { __awaiter } from "tslib";
import { AxiosError } from 'axios';
import React, { useCallback, useState } from 'react';
import { Form } from 'react-final-form';
import { AppEvents } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ConfirmModal, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { fetchServerInfoAction, fetchSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaServer, getPerconaUser } from 'app/percona/shared/core/selectors';
import { logger } from 'app/percona/shared/helpers/logger';
import { useDispatch, useSelector } from 'app/types';
import { Messages as PlatformMessages } from '../Platform.messages';
import { PlatformService } from '../Platform.service';
import { Messages } from './Connected.messages';
import { getStyles } from './Connected.styles';
import { ModalBody } from './ModalBody/ModalBody';
export const Connected = () => {
    const styles = useStyles2(getStyles);
    const [disconnecting, setDisconnecting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const { serverId = '', serverName = '' } = useSelector(getPerconaServer);
    const { isPlatformUser } = useSelector(getPerconaUser);
    const dispatch = useDispatch();
    const handleDisconnect = () => __awaiter(void 0, void 0, void 0, function* () {
        setDisconnecting(true);
        closeModal();
        try {
            yield PlatformService.disconnect();
            setTimeout(() => {
                window.location.assign(`${config.appSubUrl}/logout`);
                console.log('timeout');
                return;
            }, 3000);
        }
        catch (e) {
            logger.error(e);
            setDisconnecting(false);
        }
    });
    const handleForceDisconnect = () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        setDisconnecting(true);
        closeModal();
        try {
            yield PlatformService.forceDisconnect();
            appEvents.emit(AppEvents.alertSuccess, [Messages.forceDisconnectSucceeded]);
            setDisconnecting(false);
            dispatch(fetchServerInfoAction());
            dispatch(fetchSettingsAction());
        }
        catch (e) {
            let message = null;
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            if (e instanceof AxiosError) {
                message = (_b = (_a = e.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message;
            }
            logger.error(e);
            appEvents.emit(AppEvents.alertError, [message !== null && message !== void 0 ? message : 'Unknown error']);
        }
        finally {
            setDisconnecting(false);
        }
    });
    const closeModal = useCallback(() => setShowModal(false), []);
    const openModal = useCallback(() => setShowModal(true), []);
    return (React.createElement(React.Fragment, null,
        React.createElement("section", { "data-testid": "connected-wrapper", className: styles.wrapper },
            React.createElement("header", { className: styles.title }, Messages.title),
            React.createElement("p", null, Messages.connected),
            React.createElement(Form, { initialValues: { pmmServerId: serverId, pmmServerName: serverName }, onSubmit: () => { }, render: () => (React.createElement("form", null,
                    React.createElement(TextInputField, { name: "pmmServerId", disabled: true, label: PlatformMessages.pmmServerId }),
                    React.createElement(TextInputField, { name: "pmmServerName", disabled: true, label: PlatformMessages.pmmServerName }))) }),
            React.createElement(LoaderButton, { "data-testid": "disconnect-button", size: "md", variant: "primary", disabled: disconnecting, loading: disconnecting, onClick: openModal }, isPlatformUser ? Messages.disconnect : Messages.forceDisconnect)),
        React.createElement(ConfirmModal, { body: React.createElement(ModalBody, null), confirmText: Messages.disconnect, isOpen: showModal, title: Messages.modalTitle, onDismiss: closeModal, onConfirm: isPlatformUser ? handleDisconnect : handleForceDisconnect })));
};
//# sourceMappingURL=Connected.js.map
import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@grafana/runtime';
import { Button, ClipboardButton, DatePickerWithInput, Field, Input, Modal, RadioButtonGroup, useStyles2, } from '@grafana/ui';
const EXPIRATION_OPTIONS = [
    { label: 'No expiration', value: false },
    { label: 'Set expiration date', value: true },
];
export const CreateTokenModal = ({ isOpen, token, serviceAccountLogin, onCreateToken, onClose }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const maxExpirationDate = new Date();
    if (config.tokenExpirationDayLimit !== undefined && config.tokenExpirationDayLimit > -1) {
        maxExpirationDate.setDate(maxExpirationDate.getDate() + config.tokenExpirationDayLimit + 1);
    }
    else {
        maxExpirationDate.setDate(8640000000000000);
    }
    const defaultExpirationDate = config.tokenExpirationDayLimit !== undefined && config.tokenExpirationDayLimit > 0;
    const [defaultTokenName, setDefaultTokenName] = useState('');
    const [newTokenName, setNewTokenName] = useState('');
    const [isWithExpirationDate, setIsWithExpirationDate] = useState(defaultExpirationDate);
    const [newTokenExpirationDate, setNewTokenExpirationDate] = useState(tomorrow);
    const [isExpirationDateValid, setIsExpirationDateValid] = useState(newTokenExpirationDate !== '');
    const styles = useStyles2(getStyles);
    useEffect(() => {
        // Generate new token name every time we open modal
        if (isOpen) {
            setDefaultTokenName(`${serviceAccountLogin}-${uuidv4()}`);
        }
    }, [serviceAccountLogin, isOpen]);
    const onExpirationDateChange = (value) => {
        const isValid = value !== '';
        setIsExpirationDateValid(isValid);
        setNewTokenExpirationDate(value);
    };
    const onGenerateToken = () => {
        onCreateToken({
            name: newTokenName || defaultTokenName,
            secondsToLive: isWithExpirationDate ? getSecondsToLive(newTokenExpirationDate) : undefined,
        });
    };
    const onCloseInternal = () => {
        setNewTokenName('');
        setDefaultTokenName('');
        setIsWithExpirationDate(defaultExpirationDate);
        setNewTokenExpirationDate(tomorrow);
        setIsExpirationDateValid(newTokenExpirationDate !== '');
        onClose();
    };
    const modalTitle = !token ? 'Add service account token' : 'Service account token created';
    return (React.createElement(Modal, { isOpen: isOpen, title: modalTitle, onDismiss: onCloseInternal, className: styles.modal, contentClassName: styles.modalContent }, !token ? (React.createElement("div", null,
        React.createElement(Field, { label: "Display name", description: "Name to easily identify the token", 
            // for now this is required
            // need to make this optional in backend as well
            required: true },
            React.createElement(Input, { name: "tokenName", value: newTokenName, placeholder: defaultTokenName, onChange: (e) => {
                    setNewTokenName(e.currentTarget.value);
                } })),
        React.createElement(Field, { label: "Expiration" },
            React.createElement(RadioButtonGroup, { options: EXPIRATION_OPTIONS, value: isWithExpirationDate, onChange: setIsWithExpirationDate, size: "md" })),
        isWithExpirationDate && (React.createElement(Field, { label: "Expiration date" },
            React.createElement(DatePickerWithInput, { onChange: onExpirationDateChange, value: newTokenExpirationDate, placeholder: "", minDate: tomorrow, maxDate: maxExpirationDate }))),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { onClick: onGenerateToken, disabled: isWithExpirationDate && !isExpirationDateValid }, "Generate token")))) : (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: "Token", description: "Copy the token now as you will not be able to see it again. Losing a token requires creating a new one." },
            React.createElement("div", { className: styles.modalTokenRow },
                React.createElement(Input, { name: "tokenValue", value: token, readOnly: true }),
                React.createElement(ClipboardButton, { className: styles.modalCopyToClipboardButton, variant: "primary", size: "md", icon: "copy", getText: () => token }, "Copy clipboard"))),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(ClipboardButton, { variant: "primary", getText: () => token, onClipboardCopy: onCloseInternal }, "Copy to clipboard and close"),
            React.createElement(Button, { variant: "secondary", onClick: onCloseInternal }, "Close"))))));
};
const getSecondsToLive = (date) => {
    const dateAsDate = new Date(date);
    const now = new Date();
    return Math.ceil((dateAsDate.getTime() - now.getTime()) / 1000);
};
const getStyles = (theme) => {
    return {
        modal: css `
      width: 550px;
    `,
        modalContent: css `
      overflow: visible;
    `,
        modalTokenRow: css `
      display: flex;
    `,
        modalCopyToClipboardButton: css `
      margin-left: ${theme.spacing(0.5)};
    `,
    };
};
//# sourceMappingURL=CreateTokenModal.js.map
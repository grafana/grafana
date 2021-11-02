import { __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button';
import { useStyles2 } from '../../themes';
import { HorizontalGroup, Input } from '..';
import { selectors } from '@grafana/e2e-selectors';
export var ConfirmModal = function (_a) {
    var isOpen = _a.isOpen, title = _a.title, body = _a.body, description = _a.description, confirmText = _a.confirmText, confirmationText = _a.confirmationText, _b = _a.dismissText, dismissText = _b === void 0 ? 'Cancel' : _b, alternativeText = _a.alternativeText, _c = _a.icon, icon = _c === void 0 ? 'exclamation-triangle' : _c, onConfirm = _a.onConfirm, onDismiss = _a.onDismiss, onAlternative = _a.onAlternative;
    var _d = __read(useState(Boolean(confirmationText)), 2), disabled = _d[0], setDisabled = _d[1];
    var styles = useStyles2(getStyles);
    var buttonRef = useRef(null);
    var onConfirmationTextChange = function (event) {
        setDisabled((confirmationText === null || confirmationText === void 0 ? void 0 : confirmationText.localeCompare(event.currentTarget.value)) !== 0);
    };
    useEffect(function () {
        var _a;
        // for some reason autoFocus property did no work on this button, but this does
        (_a = buttonRef.current) === null || _a === void 0 ? void 0 : _a.focus();
    }, []);
    return (React.createElement(Modal, { className: styles.modal, title: title, icon: icon, isOpen: isOpen, onDismiss: onDismiss },
        React.createElement("div", { className: styles.modalText },
            body,
            description ? React.createElement("div", { className: styles.modalDescription }, description) : null,
            confirmationText ? (React.createElement("div", { className: styles.modalConfirmationInput },
                React.createElement(HorizontalGroup, null,
                    React.createElement(Input, { placeholder: "Type " + confirmationText + " to confirm", onChange: onConfirmationTextChange })))) : null),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, dismissText),
            React.createElement(Button, { variant: "destructive", onClick: onConfirm, disabled: disabled, ref: buttonRef, "aria-label": selectors.pages.ConfirmModal.delete }, confirmText),
            onAlternative ? (React.createElement(Button, { variant: "primary", onClick: onAlternative }, alternativeText)) : null)));
};
var getStyles = function (theme) { return ({
    modal: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 500px;\n  "], ["\n    width: 500px;\n  "]))),
    modalText: css({
        fontSize: theme.typography.h5.fontSize,
        color: theme.colors.text.primary,
    }),
    modalDescription: css({
        fontSize: theme.typography.body.fontSize,
    }),
    modalConfirmationInput: css({
        paddingTop: theme.spacing(1),
    }),
}); };
var templateObject_1;
//# sourceMappingURL=ConfirmModal.js.map
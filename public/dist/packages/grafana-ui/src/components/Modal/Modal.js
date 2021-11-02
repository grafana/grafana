import { __assign } from "tslib";
import React, { useCallback, useEffect } from 'react';
import { Portal } from '../Portal/Portal';
import { cx } from '@emotion/css';
import { useTheme2 } from '../../themes';
import { getModalStyles } from './getModalStyles';
import { ModalHeader } from './ModalHeader';
import { IconButton } from '../IconButton/IconButton';
import { HorizontalGroup } from '../Layout/Layout';
export function Modal(props) {
    var title = props.title, children = props.children, _a = props.isOpen, isOpen = _a === void 0 ? false : _a, _b = props.closeOnEscape, closeOnEscape = _b === void 0 ? true : _b, _c = props.closeOnBackdropClick, closeOnBackdropClick = _c === void 0 ? true : _c, className = props.className, contentClassName = props.contentClassName, propsOnDismiss = props.onDismiss, onClickBackdrop = props.onClickBackdrop;
    var theme = useTheme2();
    var styles = getModalStyles(theme);
    var onDismiss = useCallback(function () {
        if (propsOnDismiss) {
            propsOnDismiss();
        }
    }, [propsOnDismiss]);
    useEffect(function () {
        var onEscKey = function (ev) {
            if (ev.key === 'Esc' || ev.key === 'Escape') {
                onDismiss();
            }
        };
        if (isOpen && closeOnEscape) {
            document.addEventListener('keydown', onEscKey, false);
        }
        else {
            document.removeEventListener('keydown', onEscKey, false);
        }
        return function () {
            document.removeEventListener('keydown', onEscKey, false);
        };
    }, [closeOnEscape, isOpen, onDismiss]);
    if (!isOpen) {
        return null;
    }
    var headerClass = cx(styles.modalHeader, typeof title !== 'string' && styles.modalHeaderWithTabs);
    return (React.createElement(Portal, null,
        React.createElement("div", { className: styles.modalBackdrop, onClick: onClickBackdrop || (closeOnBackdropClick ? onDismiss : undefined) }),
        React.createElement("div", { className: cx(styles.modal, className) },
            React.createElement("div", { className: headerClass },
                typeof title === 'string' && React.createElement(DefaultModalHeader, __assign({}, props, { title: title })),
                typeof title !== 'string' && title,
                React.createElement("div", { className: styles.modalHeaderClose },
                    React.createElement(IconButton, { "aria-label": "Close dialogue", surface: "header", name: "times", size: "xl", onClick: onDismiss }))),
            React.createElement("div", { className: cx(styles.modalContent, contentClassName) }, children))));
}
function ModalButtonRow(_a) {
    var leftItems = _a.leftItems, children = _a.children;
    var theme = useTheme2();
    var styles = getModalStyles(theme);
    if (leftItems) {
        return (React.createElement("div", { className: styles.modalButtonRow },
            React.createElement(HorizontalGroup, { justify: "space-between" },
                React.createElement(HorizontalGroup, { justify: "flex-start", spacing: "md" }, leftItems),
                React.createElement(HorizontalGroup, { justify: "flex-end", spacing: "md" }, children))));
    }
    return (React.createElement("div", { className: styles.modalButtonRow },
        React.createElement(HorizontalGroup, { justify: "flex-end", spacing: "md" }, children)));
}
Modal.ButtonRow = ModalButtonRow;
function DefaultModalHeader(_a) {
    var icon = _a.icon, iconTooltip = _a.iconTooltip, title = _a.title;
    return React.createElement(ModalHeader, { icon: icon, iconTooltip: iconTooltip, title: title });
}
//# sourceMappingURL=Modal.js.map
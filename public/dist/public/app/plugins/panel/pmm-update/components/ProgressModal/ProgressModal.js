import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ClipboardButton, Icon, Button, Modal, useStyles2 } from '@grafana/ui';
import { ProgressModalHeader } from '../../components';
import { useClickOutside } from '../../hooks';
import { Messages } from './ProgressModal.messages';
import { getStyles } from './ProgressModal.styles';
export const ProgressModal = ({ version, errorMessage = '', isOpen = false, isUpdated = false, output = '', updateFailed = false, }) => {
    const styles = useStyles2(getStyles);
    const outputRef = useRef(null);
    const modalRef = useRef(null);
    const [isOutputShown, setIsOutputShown] = useState(true);
    useClickOutside(modalRef, () => {
        if (isUpdated) {
            // @ts-ignore
            // eslint-disable-next-line no-restricted-globals
            location.reload(true);
        }
    });
    useLayoutEffect(() => {
        // scroll upgrade status to the end.
        const interval = setInterval(() => { var _a; return (_a = outputRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView(false); }, 500);
        return () => {
            clearInterval(interval);
        };
    }, []);
    const handleToggleShowOutput = () => {
        setIsOutputShown((isOutputShown) => !isOutputShown);
    };
    const reloadAfterUpdate = () => {
        // @ts-ignore
        // eslint-disable-next-line no-restricted-globals
        location.reload(true);
    };
    const copyToClipboard = useCallback(() => { var _a, _b; return (_b = (_a = outputRef.current) === null || _a === void 0 ? void 0 : _a.textContent) !== null && _b !== void 0 ? _b : ''; }, [outputRef]);
    const chevronIcon = isOutputShown ? 'angle-down' : 'angle-up';
    // TODO (nicolalamacchia): componentize this further
    return (React.createElement(Modal, { title: "", isOpen: isOpen },
        React.createElement("div", { ref: modalRef, className: styles.modal, role: "document", "data-testid": "progress-modal-container" },
            React.createElement(ProgressModalHeader, { isUpdated: isUpdated, updateFailed: updateFailed, errorMessage: errorMessage }),
            !isUpdated ? (React.createElement("div", { className: styles.outputContent },
                React.createElement("div", { className: styles.outputHeader },
                    React.createElement(Icon, { className: styles.outputVisibilityToggle, "data-testid": `modal-chevron-icon-${chevronIcon}`, name: chevronIcon, onClick: handleToggleShowOutput }),
                    React.createElement("span", null, Messages.log),
                    React.createElement(ClipboardButton, { getText: copyToClipboard, className: styles.clipboardButton, variant: "secondary", size: "sm" }, Messages.copyToClipboard)),
                isOutputShown && (React.createElement("div", { className: styles.output },
                    React.createElement("pre", { "data-testid": "modal-output-pre", ref: outputRef }, output))))) : (React.createElement(React.Fragment, null,
                React.createElement("div", { className: styles.successNote },
                    React.createElement("h6", { "data-testid": "modal-update-success-text" },
                        Messages.updateSuccessNotice,
                        " ",
                        version)),
                React.createElement(Button, { className: styles.closeModal, "data-testid": "modal-close", variant: "primary", onClick: reloadAfterUpdate }, Messages.close))))));
};
//# sourceMappingURL=ProgressModal.js.map
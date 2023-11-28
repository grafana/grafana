import React, { useCallback } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { ClipboardButton, CodeEditor, Modal } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
export function ViewJsonModal({ json, onDismiss }) {
    const getClipboardText = useCallback(() => json, [json]);
    return (React.createElement(Modal, { title: "JSON", onDismiss: onDismiss, onClickBackdrop: onDismiss, isOpen: true },
        React.createElement(AutoSizer, { disableHeight: true }, ({ width }) => React.createElement(CodeEditor, { value: json, language: "json", showMiniMap: false, height: "500px", width: width })),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(ClipboardButton, { icon: "copy", getText: getClipboardText },
                React.createElement(Trans, { i18nKey: "share-modal.view-json.copy-button" }, "Copy to Clipboard")))));
}
//# sourceMappingURL=ViewJsonModal.js.map
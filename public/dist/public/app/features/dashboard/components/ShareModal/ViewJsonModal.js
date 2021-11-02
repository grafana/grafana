import React, { useCallback } from 'react';
import { ClipboardButton, CodeEditor, Modal } from '@grafana/ui';
import AutoSizer from 'react-virtualized-auto-sizer';
import { notifyApp } from '../../../../core/actions';
import { dispatch } from '../../../../store/store';
import { createSuccessNotification } from '../../../../core/copy/appNotification';
export function ViewJsonModal(_a) {
    var json = _a.json, onDismiss = _a.onDismiss;
    var getClipboardText = useCallback(function () { return json; }, [json]);
    var onClipboardCopy = function () {
        dispatch(notifyApp(createSuccessNotification('Content copied to clipboard')));
    };
    return (React.createElement(Modal, { title: "JSON", onDismiss: onDismiss, onClickBackdrop: onDismiss, isOpen: true },
        React.createElement(AutoSizer, { disableHeight: true }, function (_a) {
            var width = _a.width;
            return React.createElement(CodeEditor, { value: json, language: "json", showMiniMap: false, height: "500px", width: width });
        }),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(ClipboardButton, { getText: getClipboardText, onClipboardCopy: onClipboardCopy }, "Copy to Clipboard"))));
}
//# sourceMappingURL=ViewJsonModal.js.map
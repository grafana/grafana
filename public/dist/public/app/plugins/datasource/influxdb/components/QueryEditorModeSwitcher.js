import { __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { Button, ConfirmModal } from '@grafana/ui';
export var QueryEditorModeSwitcher = function (_a) {
    var isRaw = _a.isRaw, onChange = _a.onChange;
    var _b = __read(useState(false), 2), isModalOpen = _b[0], setModalOpen = _b[1];
    useEffect(function () {
        // if the isRaw changes, we hide the modal
        setModalOpen(false);
    }, [isRaw]);
    if (isRaw) {
        return (React.createElement(React.Fragment, null,
            React.createElement(Button, { icon: "pen", variant: "secondary", type: "button", onClick: function () {
                    // we show the are-you-sure modal
                    setModalOpen(true);
                } }),
            React.createElement(ConfirmModal, { isOpen: isModalOpen, title: "Switch to visual editor mode", body: "Are you sure to switch to visual editor mode? You will lose the changes done in raw query mode.", confirmText: "Yes, switch to editor mode", dismissText: "No, stay in raw query mode", onConfirm: function () {
                    onChange(false);
                }, onDismiss: function () {
                    setModalOpen(false);
                } })));
    }
    else {
        return (React.createElement(Button, { icon: "pen", variant: "secondary", type: "button", onClick: function () {
                onChange(true);
            } }));
    }
};
//# sourceMappingURL=QueryEditorModeSwitcher.js.map
import React from 'react';
import { Icon, ModalsController } from '@grafana/ui';
import { RowOptionsModal } from './RowOptionsModal';
export var RowOptionsButton = function (_a) {
    var repeat = _a.repeat, title = _a.title, onUpdate = _a.onUpdate;
    var onUpdateChange = function (hideModal) { return function (title, repeat) {
        onUpdate(title, repeat);
        hideModal();
    }; };
    return (React.createElement(ModalsController, null, function (_a) {
        var showModal = _a.showModal, hideModal = _a.hideModal;
        return (React.createElement("a", { className: "pointer", onClick: function () {
                showModal(RowOptionsModal, { title: title, repeat: repeat, onDismiss: hideModal, onUpdate: onUpdateChange(hideModal) });
            } },
            React.createElement(Icon, { name: "cog" })));
    }));
};
RowOptionsButton.displayName = 'RowOptionsButton';
//# sourceMappingURL=RowOptionsButton.js.map
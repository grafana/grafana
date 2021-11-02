import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Modal, stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';
import { RowOptionsForm } from './RowOptionsForm';
export var RowOptionsModal = function (_a) {
    var repeat = _a.repeat, title = _a.title, onDismiss = _a.onDismiss, onUpdate = _a.onUpdate;
    var styles = getStyles();
    return (React.createElement(Modal, { isOpen: true, title: "Row options", icon: "copy", onDismiss: onDismiss, className: styles.modal },
        React.createElement(RowOptionsForm, { repeat: repeat, title: title, onCancel: onDismiss, onUpdate: onUpdate })));
};
var getStyles = stylesFactory(function () {
    return {
        modal: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: RowOptionsModal;\n      width: 500px;\n    "], ["\n      label: RowOptionsModal;\n      width: 500px;\n    "]))),
    };
});
var templateObject_1;
//# sourceMappingURL=RowOptionsModal.js.map
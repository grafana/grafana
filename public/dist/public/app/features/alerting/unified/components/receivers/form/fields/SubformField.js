import { __read } from "tslib";
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { OptionField } from './OptionField';
import { Button, useStyles2 } from '@grafana/ui';
import { ActionIcon } from '../../../rules/ActionIcon';
import { getReceiverFormFieldStyles } from './styles';
export var SubformField = function (_a) {
    var _b;
    var option = _a.option, pathPrefix = _a.pathPrefix, errors = _a.errors, defaultValue = _a.defaultValue, _c = _a.readOnly, readOnly = _c === void 0 ? false : _c;
    var styles = useStyles2(getReceiverFormFieldStyles);
    var name = "" + pathPrefix + option.propertyName;
    var watch = useFormContext().watch;
    var _watchValue = watch(name);
    var value = _watchValue === undefined ? defaultValue : _watchValue;
    var _d = __read(useState(!!value), 2), show = _d[0], setShow = _d[1];
    return (React.createElement("div", { className: styles.wrapper, "data-testid": name + ".container" },
        React.createElement("h6", null, option.label),
        option.description && React.createElement("p", { className: styles.description }, option.description),
        show && (React.createElement(React.Fragment, null,
            !readOnly && (React.createElement(ActionIcon, { "data-testid": name + ".delete-button", icon: "trash-alt", tooltip: "delete", onClick: function () { return setShow(false); }, className: styles.deleteIcon })),
            ((_b = option.subformOptions) !== null && _b !== void 0 ? _b : []).map(function (subOption) {
                return (React.createElement(OptionField, { readOnly: readOnly, defaultValue: defaultValue === null || defaultValue === void 0 ? void 0 : defaultValue[subOption.propertyName], key: subOption.propertyName, option: subOption, pathPrefix: name + ".", error: errors === null || errors === void 0 ? void 0 : errors[subOption.propertyName] }));
            }))),
        !show && !readOnly && (React.createElement(Button, { className: styles.addButton, type: "button", variant: "secondary", icon: "plus", size: "sm", onClick: function () { return setShow(true); }, "data-testid": name + ".add-button" }, "Add"))));
};
//# sourceMappingURL=SubformField.js.map
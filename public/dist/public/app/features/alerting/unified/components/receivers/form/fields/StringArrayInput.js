import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Button, Input, useStyles2 } from '@grafana/ui';
import { ActionIcon } from '../../../rules/ActionIcon';
export var StringArrayInput = function (_a) {
    var value = _a.value, onChange = _a.onChange, _b = _a.readOnly, readOnly = _b === void 0 ? false : _b;
    var styles = useStyles2(getStyles);
    var deleteItem = function (index) {
        if (!value) {
            return;
        }
        var newValue = value.slice();
        newValue.splice(index, 1);
        onChange(newValue);
    };
    var updateValue = function (itemValue, index) {
        if (!value) {
            return;
        }
        onChange(value.map(function (v, i) { return (i === index ? itemValue : v); }));
    };
    return (React.createElement("div", null,
        !!(value === null || value === void 0 ? void 0 : value.length) &&
            value.map(function (v, index) { return (React.createElement("div", { key: index, className: styles.row },
                React.createElement(Input, { readOnly: readOnly, value: v, onChange: function (e) { return updateValue(e.currentTarget.value, index); } }),
                !readOnly && (React.createElement(ActionIcon, { className: styles.deleteIcon, icon: "trash-alt", tooltip: "delete", onClick: function () { return deleteItem(index); } })))); }),
        !readOnly && (React.createElement(Button, { className: styles.addButton, type: "button", variant: "secondary", icon: "plus", size: "sm", onClick: function () { return onChange(__spreadArray(__spreadArray([], __read((value !== null && value !== void 0 ? value : [])), false), [''], false)); } }, "Add"))));
};
var getStyles = function (theme) { return ({
    row: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    margin-bottom: ", ";\n    align-items: center;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    margin-bottom: ", ";\n    align-items: center;\n  "])), theme.spacing(1)),
    deleteIcon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-left: ", ";\n  "], ["\n    margin-left: ", ";\n  "])), theme.spacing(1)),
    addButton: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(1)),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=StringArrayInput.js.map
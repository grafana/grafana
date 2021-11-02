import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Button, useTheme2 } from '@grafana/ui';
import { VariableOrigin, DataLinkBuiltInVars } from '@grafana/data';
import { DerivedField } from './DerivedField';
import { DebugSection } from './DebugSection';
var getStyles = function (theme) { return ({
    infoText: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding-bottom: ", ";\n    color: ", ";\n  "], ["\n    padding-bottom: ", ";\n    color: ", ";\n  "])), theme.spacing(2), theme.colors.text.secondary),
    derivedField: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing(1)),
}); };
export var DerivedFields = function (props) {
    var value = props.value, onChange = props.onChange;
    var theme = useTheme2();
    var styles = getStyles(theme);
    var _a = __read(useState(false), 2), showDebug = _a[0], setShowDebug = _a[1];
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Derived fields"),
        React.createElement("div", { className: styles.infoText }, "Derived fields can be used to extract new fields from a log message and create a link from its value."),
        React.createElement("div", { className: "gf-form-group" },
            value &&
                value.map(function (field, index) {
                    return (React.createElement(DerivedField, { className: styles.derivedField, key: index, value: field, onChange: function (newField) {
                            var newDerivedFields = __spreadArray([], __read(value), false);
                            newDerivedFields.splice(index, 1, newField);
                            onChange(newDerivedFields);
                        }, onDelete: function () {
                            var newDerivedFields = __spreadArray([], __read(value), false);
                            newDerivedFields.splice(index, 1);
                            onChange(newDerivedFields);
                        }, suggestions: [
                            {
                                value: DataLinkBuiltInVars.valueRaw,
                                label: 'Raw value',
                                documentation: 'Exact string captured by the regular expression',
                                origin: VariableOrigin.Value,
                            },
                        ] }));
                }),
            React.createElement("div", null,
                React.createElement(Button, { variant: "secondary", className: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n              margin-right: 10px;\n            "], ["\n              margin-right: 10px;\n            "]))), icon: "plus", onClick: function (event) {
                        event.preventDefault();
                        var newDerivedFields = __spreadArray(__spreadArray([], __read((value || [])), false), [{ name: '', matcherRegex: '' }], false);
                        onChange(newDerivedFields);
                    } }, "Add"),
                value && value.length > 0 && (React.createElement(Button, { variant: "secondary", type: "button", onClick: function () { return setShowDebug(!showDebug); } }, showDebug ? 'Hide example log message' : 'Show example log message')))),
        showDebug && (React.createElement("div", { className: "gf-form-group" },
            React.createElement(DebugSection, { className: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n              margin-bottom: 10px;\n            "], ["\n              margin-bottom: 10px;\n            "]))), derivedFields: value })))));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=DerivedFields.js.map
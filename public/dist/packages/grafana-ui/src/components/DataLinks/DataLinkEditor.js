import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { Switch } from '../Switch/Switch';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes/index';
import { DataLinkInput } from './DataLinkInput';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';
var getStyles = function (theme) { return ({
    listItem: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing()),
    infoText: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    padding-bottom: ", ";\n    margin-left: 66px;\n    color: ", ";\n  "], ["\n    padding-bottom: ", ";\n    margin-left: 66px;\n    color: ", ";\n  "])), theme.spacing(2), theme.colors.text.secondary),
}); };
export var DataLinkEditor = React.memo(function (_a) {
    var index = _a.index, value = _a.value, onChange = _a.onChange, suggestions = _a.suggestions, isLast = _a.isLast;
    var styles = useStyles2(getStyles);
    var onUrlChange = function (url, callback) {
        onChange(index, __assign(__assign({}, value), { url: url }), callback);
    };
    var onTitleChange = function (event) {
        onChange(index, __assign(__assign({}, value), { title: event.target.value }));
    };
    var onOpenInNewTabChanged = function () {
        onChange(index, __assign(__assign({}, value), { targetBlank: !value.targetBlank }));
    };
    return (React.createElement("div", { className: styles.listItem },
        React.createElement(Field, { label: "Title" },
            React.createElement(Input, { value: value.title, onChange: onTitleChange, placeholder: "Show details" })),
        React.createElement(Field, { label: "URL" },
            React.createElement(DataLinkInput, { value: value.url, onChange: onUrlChange, suggestions: suggestions })),
        React.createElement(Field, { label: "Open in new tab" },
            React.createElement(Switch, { value: value.targetBlank || false, onChange: onOpenInNewTabChanged })),
        isLast && (React.createElement("div", { className: styles.infoText }, "With data links you can reference data variables like series name, labels and values. Type CMD+Space, CTRL+Space, or $ to open variable suggestions."))));
});
DataLinkEditor.displayName = 'DataLinkEditor';
var templateObject_1, templateObject_2;
//# sourceMappingURL=DataLinkEditor.js.map
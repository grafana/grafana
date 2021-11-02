import { __assign } from "tslib";
import React from 'react';
import { LegacyForms } from '@grafana/ui';
var FormField = LegacyForms.FormField;
export var LogsConfig = function (props) {
    var value = props.value, onChange = props.onChange;
    var changeHandler = function (key) { return function (event) {
        var _a;
        onChange(__assign(__assign({}, value), (_a = {}, _a[key] = event.currentTarget.value, _a)));
    }; };
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Logs"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form max-width-30" },
                React.createElement(FormField, { labelWidth: 11, label: "Message field name", value: value.logMessageField, onChange: changeHandler('logMessageField'), placeholder: "_source" })),
            React.createElement("div", { className: "gf-form max-width-30" },
                React.createElement(FormField, { labelWidth: 11, label: "Level field name", value: value.logLevelField, onChange: changeHandler('logLevelField') })))));
};
//# sourceMappingURL=LogsConfig.js.map
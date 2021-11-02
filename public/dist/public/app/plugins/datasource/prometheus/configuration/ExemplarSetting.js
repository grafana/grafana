import { __assign, __makeTemplateObject, __read } from "tslib";
import { css } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineSwitch, Input } from '@grafana/ui';
import React, { useState } from 'react';
export default function ExemplarSetting(_a) {
    var value = _a.value, onChange = _a.onChange, onDelete = _a.onDelete;
    var _b = __read(useState(Boolean(value.datasourceUid)), 2), isInternalLink = _b[0], setIsInternalLink = _b[1];
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement(InlineField, { label: "Internal link", labelWidth: 24 },
            React.createElement(React.Fragment, null,
                React.createElement(InlineSwitch, { value: isInternalLink, "aria-label": selectors.components.DataSource.Prometheus.configPage.internalLinkSwitch, onChange: function (ev) { return setIsInternalLink(ev.currentTarget.checked); } }),
                React.createElement(Button, { variant: "destructive", title: "Remove link", icon: "times", onClick: function (event) {
                        event.preventDefault();
                        onDelete();
                    }, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n              margin-left: 8px;\n            "], ["\n              margin-left: 8px;\n            "]))) }))),
        isInternalLink ? (React.createElement(InlineField, { label: "Data source", labelWidth: 24, tooltip: "The data source the exemplar is going to navigate to." },
            React.createElement(DataSourcePicker, { tracing: true, current: value.datasourceUid, noDefault: true, width: 40, onChange: function (ds) {
                    return onChange({
                        datasourceUid: ds.uid,
                        name: value.name,
                        url: undefined,
                    });
                } }))) : (React.createElement(InlineField, { label: "URL", labelWidth: 24, tooltip: "The URL of the trace backend the user would go to see its trace." },
            React.createElement(Input, { placeholder: "https://example.com/${__value.raw}", spellCheck: false, width: 40, value: value.url, onChange: function (event) {
                    return onChange({
                        datasourceUid: undefined,
                        name: value.name,
                        url: event.currentTarget.value,
                    });
                } }))),
        React.createElement(InlineField, { label: "Label name", labelWidth: 24, tooltip: "The name of the field in the labels object that should be used to get the traceID." },
            React.createElement(Input, { placeholder: "traceID", spellCheck: false, width: 40, value: value.name, onChange: function (event) {
                    return onChange(__assign(__assign({}, value), { name: event.currentTarget.value }));
                } }))));
}
var templateObject_1;
//# sourceMappingURL=ExemplarSetting.js.map
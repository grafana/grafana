import { __assign } from "tslib";
import React from 'react';
import { LegacyForms } from '@grafana/ui';
var Switch = LegacyForms.Switch;
import { QueryField, PanelQueryEditor } from './';
export function AnnotationQueryEditor(props) {
    var query = props.query, onChange = props.onChange;
    return (React.createElement(React.Fragment, null,
        React.createElement(PanelQueryEditor, __assign({}, props, { onChange: function (editorQuery) { return onChange(__assign(__assign({}, query), editorQuery)); }, onRunQuery: function () { }, history: [] })),
        React.createElement("div", { className: "gf-form-inline" },
            React.createElement(Switch, { label: "Enable Prefix Matching", labelClass: "query-keyword", checked: query.prefixMatching, onChange: function () { return onChange(__assign(__assign({}, query), { prefixMatching: !query.prefixMatching })); } }),
            React.createElement("div", { className: "gf-form gf-form--grow" },
                React.createElement(QueryField, { label: "Action" },
                    React.createElement("input", { disabled: !query.prefixMatching, className: "gf-form-input width-12", value: query.actionPrefix || '', onChange: function (event) {
                            return onChange(__assign(__assign({}, query), { actionPrefix: event.target.value }));
                        } })),
                React.createElement(QueryField, { label: "Alarm Name" },
                    React.createElement("input", { disabled: !query.prefixMatching, className: "gf-form-input width-12", value: query.alarmNamePrefix || '', onChange: function (event) {
                            return onChange(__assign(__assign({}, query), { alarmNamePrefix: event.target.value }));
                        } })),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))))));
}
//# sourceMappingURL=AnnotationQueryEditor.js.map
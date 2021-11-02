import React from 'react';
import { LegacyForms } from '@grafana/ui';
var FormField = LegacyForms.FormField;
export var MaxLinesField = function (props) {
    var value = props.value, onChange = props.onChange;
    return (React.createElement(FormField, { label: "Maximum lines", labelWidth: 11, inputWidth: 20, inputEl: React.createElement("input", { type: "number", className: "gf-form-input width-8 gf-form-input--has-help-icon", value: value, onChange: function (event) { return onChange(event.currentTarget.value); }, spellCheck: false, placeholder: "1000" }), tooltip: React.createElement(React.Fragment, null, "Loki queries must contain a limit of the maximum number of lines returned (default: 1000). Increase this limit to have a bigger result set for ad-hoc analysis. Decrease this limit if your browser becomes sluggish when displaying the log results.") }));
};
//# sourceMappingURL=MaxLinesField.js.map
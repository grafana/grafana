import React from 'react';
var SimpleSelect = function (props) {
    var label = props.label, onValueChange = props.onValueChange, value = props.value, options = props.options;
    return (React.createElement("div", { className: "gf-form max-width-21" },
        React.createElement("span", { className: "gf-form-label width-10 query-keyword" }, label),
        React.createElement("div", { className: "gf-form-select-wrapper max-width-12" },
            React.createElement("select", { className: "gf-form-input", required: true, onChange: onValueChange, value: value }, options.map(function (_a, i) {
                var value = _a.value, name = _a.name;
                return (React.createElement("option", { key: i, value: value }, name));
            })))));
};
export default SimpleSelect;
//# sourceMappingURL=SimpleSelect.js.map
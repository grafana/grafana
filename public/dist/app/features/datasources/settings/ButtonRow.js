import React from 'react';
import config from 'app/core/config';
var ButtonRow = function (_a) {
    var isReadOnly = _a.isReadOnly, onDelete = _a.onDelete, onSubmit = _a.onSubmit, onTest = _a.onTest;
    return (React.createElement("div", { className: "gf-form-button-row" },
        !isReadOnly && (React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: isReadOnly, onClick: function (event) { return onSubmit(event); } }, "Save & Test")),
        isReadOnly && (React.createElement("button", { type: "submit", className: "btn btn-success", onClick: onTest }, "Test")),
        React.createElement("button", { type: "submit", className: "btn btn-danger", disabled: isReadOnly, onClick: onDelete }, "Delete"),
        React.createElement("a", { className: "btn btn-inverse", href: config.appSubUrl + "/datasources" }, "Back")));
};
export default ButtonRow;
//# sourceMappingURL=ButtonRow.js.map
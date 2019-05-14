import React from 'react';
var OrgProfile = function (_a) {
    var onSubmit = _a.onSubmit, onOrgNameChange = _a.onOrgNameChange, orgName = _a.orgName;
    return (React.createElement("div", null,
        React.createElement("h3", { className: "page-sub-heading" }, "Organization profile"),
        React.createElement("form", { name: "orgForm", className: "gf-form-group", onSubmit: function (event) {
                event.preventDefault();
                onSubmit();
            } },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form max-width-28" },
                    React.createElement("span", { className: "gf-form-label" }, "Organization name"),
                    React.createElement("input", { className: "gf-form-input", type: "text", onChange: function (event) {
                            onOrgNameChange(event.target.value);
                        }, value: orgName }))),
            React.createElement("div", { className: "gf-form-button-row" },
                React.createElement("button", { type: "submit", className: "btn btn-primary" }, "Save")))));
};
export default OrgProfile;
//# sourceMappingURL=OrgProfile.js.map
import React from 'react';
export var ApiKeysAddedModal = function (props) {
    return (React.createElement("div", { className: "modal-body" },
        React.createElement("div", { className: "modal-header" },
            React.createElement("h2", { className: "modal-header-title" },
                React.createElement("i", { className: "fa fa-key" }),
                React.createElement("span", { className: "p-l-1" }, "API Key Created")),
            React.createElement("a", { className: "modal-header-close", "ng-click": "dismiss();" },
                React.createElement("i", { className: "fa fa-remove" }))),
        React.createElement("div", { className: "modal-content" },
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("span", { className: "gf-form-label" }, "Key"),
                    React.createElement("span", { className: "gf-form-label" }, props.apiKey))),
            React.createElement("div", { className: "grafana-info-box", style: { border: 0 } },
                "You will only be able to view this key here once! It is not stored in this form. So be sure to copy it now.",
                React.createElement("br", null),
                React.createElement("br", null),
                "You can authenticate request using the Authorization HTTP header, example:",
                React.createElement("br", null),
                React.createElement("br", null),
                React.createElement("pre", { className: "small" },
                    "curl -H \"Authorization: Bearer ",
                    props.apiKey,
                    "\" ",
                    props.rootPath,
                    "/api/dashboards/home")))));
};
export default ApiKeysAddedModal;
//# sourceMappingURL=ApiKeysAddedModal.js.map
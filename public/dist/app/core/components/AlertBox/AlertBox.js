import React from 'react';
import { AppNotificationSeverity } from 'app/types';
function getIconFromSeverity(severity) {
    switch (severity) {
        case AppNotificationSeverity.Error: {
            return 'fa fa-exclamation-triangle';
        }
        case AppNotificationSeverity.Success: {
            return 'fa fa-check';
        }
        default:
            return null;
    }
}
export var AlertBox = function (_a) {
    var title = _a.title, icon = _a.icon, text = _a.text, severity = _a.severity, onClose = _a.onClose;
    return (React.createElement("div", { className: "alert alert-" + severity },
        React.createElement("div", { className: "alert-icon" },
            React.createElement("i", { className: icon || getIconFromSeverity(severity) })),
        React.createElement("div", { className: "alert-body" },
            React.createElement("div", { className: "alert-title" }, title),
            text && React.createElement("div", { className: "alert-text" }, text)),
        onClose && (React.createElement("button", { type: "button", className: "alert-close", onClick: onClose },
            React.createElement("i", { className: "fa fa fa-remove" })))));
};
//# sourceMappingURL=AlertBox.js.map
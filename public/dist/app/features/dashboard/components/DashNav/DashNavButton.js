// Libraries
import React from 'react';
// Components
import { Tooltip } from '@grafana/ui';
export var DashNavButton = function (_a) {
    var icon = _a.icon, tooltip = _a.tooltip, classSuffix = _a.classSuffix, onClick = _a.onClick, href = _a.href;
    if (onClick) {
        return (React.createElement(Tooltip, { content: tooltip },
            React.createElement("button", { className: "btn navbar-button navbar-button--" + classSuffix, onClick: onClick },
                React.createElement("i", { className: icon }))));
    }
    return (React.createElement(Tooltip, { content: tooltip },
        React.createElement("a", { className: "btn navbar-button navbar-button--" + classSuffix, href: href },
            React.createElement("i", { className: icon }))));
};
//# sourceMappingURL=DashNavButton.js.map
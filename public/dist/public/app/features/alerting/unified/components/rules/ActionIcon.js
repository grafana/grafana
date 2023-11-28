import { __rest } from "tslib";
import React from 'react';
import { Tooltip, LinkButton, Button } from '@grafana/ui';
export const ActionIcon = (_a) => {
    var { tooltip, icon, to, target, onClick, className, tooltipPlacement = 'top' } = _a, rest = __rest(_a, ["tooltip", "icon", "to", "target", "onClick", "className", "tooltipPlacement"]);
    const ariaLabel = typeof tooltip === 'string' ? tooltip : undefined;
    return (React.createElement(Tooltip, { content: tooltip, placement: tooltipPlacement }, to ? (React.createElement(LinkButton, Object.assign({ variant: "secondary", fill: "text", icon: icon, href: to, size: "sm", target: target }, rest, { "aria-label": ariaLabel }))) : (React.createElement(Button, Object.assign({ className: className, variant: "secondary", fill: "text", size: "sm", icon: icon, type: "button", onClick: onClick }, rest, { "aria-label": ariaLabel })))));
};
//# sourceMappingURL=ActionIcon.js.map
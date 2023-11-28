import { __rest } from "tslib";
import React from 'react';
import { Button } from '@grafana/ui';
export const CollapseToggle = (_a) => {
    var { isCollapsed, onToggle, idControlled, className, text, size = 'xl' } = _a, restOfProps = __rest(_a, ["isCollapsed", "onToggle", "idControlled", "className", "text", "size"]);
    return (React.createElement(Button, Object.assign({ type: "button", fill: "text", variant: "secondary", "aria-expanded": !isCollapsed, "aria-controls": idControlled, className: className, icon: isCollapsed ? 'angle-right' : 'angle-down', onClick: () => onToggle(!isCollapsed) }, restOfProps), text));
};
//# sourceMappingURL=CollapseToggle.js.map
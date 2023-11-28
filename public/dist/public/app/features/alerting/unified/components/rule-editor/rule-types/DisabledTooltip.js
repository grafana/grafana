import React from 'react';
import { Tooltip } from '@grafana/ui';
const DisabledTooltip = ({ children, visible = false }) => {
    if (!visible) {
        return React.createElement(React.Fragment, null, children);
    }
    return (React.createElement(Tooltip, { content: "You do not appear to have any compatible datasources.", placement: "top" },
        React.createElement("div", null, children)));
};
export { DisabledTooltip };
//# sourceMappingURL=DisabledTooltip.js.map
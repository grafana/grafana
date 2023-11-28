import React from 'react';
import { Icon, Tooltip } from '@grafana/ui';
export function InfoIcon({ text }) {
    return (React.createElement(Tooltip, { placement: "top", content: React.createElement("div", null, text) },
        React.createElement(Icon, { name: "info-circle", size: "xs" })));
}
//# sourceMappingURL=InfoIcon.js.map
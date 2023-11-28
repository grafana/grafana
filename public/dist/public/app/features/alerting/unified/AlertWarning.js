import { css } from '@emotion/css';
import React from 'react';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';
export function AlertWarning({ title, children }) {
    return (React.createElement(Alert, { className: useStyles2(warningStyles).warning, severity: "warning", title: title },
        React.createElement("p", null, children),
        React.createElement(LinkButton, { href: "alerting/list" }, "To rule list")));
}
const warningStyles = (theme) => ({
    warning: css `
    margin: ${theme.spacing(4)};
  `,
});
//# sourceMappingURL=AlertWarning.js.map
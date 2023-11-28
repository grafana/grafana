import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';
import { ROUTES } from '../../constants';
const getStyles = (theme) => ({
    alertContent: css `
    display: flex;
    flex-direction: row;
    padding: 0;
    justify-content: space-between;
    align-items: center;
  `,
    alertParagraph: css `
    margin: 0 ${theme.spacing(1)} 0 0;
    line-height: ${theme.spacing(theme.components.height.sm)};
  `,
});
export function ConnectionsRedirectNotice() {
    const styles = useStyles2(getStyles);
    const [showNotice, setShowNotice] = useState(true);
    return showNotice ? (React.createElement(Alert, { severity: "info", title: "", onRemove: () => setShowNotice(false) },
        React.createElement("div", { className: styles.alertContent },
            React.createElement("p", { className: styles.alertParagraph }, "Data sources have a new home! You can discover new data sources or manage existing ones in the Connections page, accessible from the main menu."),
            React.createElement(LinkButton, { "aria-label": "Link to Connections", icon: "arrow-right", href: ROUTES.DataSources, fill: "text" }, "Go to connections")))) : (React.createElement(React.Fragment, null));
}
//# sourceMappingURL=ConnectionsRedirectNotice.js.map
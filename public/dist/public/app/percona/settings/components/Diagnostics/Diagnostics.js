import React from 'react';
import { Icon, LinkButton, Tooltip, useStyles2 } from '@grafana/ui';
import { Messages } from 'app/percona/settings/Settings.messages';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { getStyles } from './Diagnostics.styles';
export const Diagnostics = () => {
    const styles = useStyles2(getStyles);
    const settingsStyles = useStyles2(getSettingsStyles);
    const { diagnostics: { action, label, tooltip }, } = Messages;
    return (React.createElement("div", { className: styles.diagnosticsWrapper },
        React.createElement("div", { className: settingsStyles.labelWrapper, "data-testid": "diagnostics-label" },
            label,
            React.createElement(Tooltip, { content: tooltip },
                React.createElement("div", null,
                    React.createElement(Icon, { name: "info-circle" })))),
        React.createElement(LinkButton, { target: "_blank", href: "/logs.zip", className: styles.diagnosticsButton, variant: "secondary", "data-testid": "diagnostics-button" },
            React.createElement(Icon, { name: "download-alt" }),
            React.createElement("span", null, action))));
};
//# sourceMappingURL=Diagnostics.js.map
import React from 'react';
import { Icon, Tooltip, useTheme } from '@grafana/ui';
import { Messages } from './TechnicalPreview.messages';
import { getStyles } from './TechnicalPreview.styles';
export const ReadMoreLink = () => {
    const theme = useTheme();
    const styles = getStyles(theme);
    return (React.createElement("span", null,
        Messages.tooltipDescription,
        ' ',
        React.createElement("a", { href: "https://per.co.na/pmm-feature-status", target: "_blank", rel: "noreferrer", className: styles.link }, Messages.linkText)));
};
export const TechnicalPreview = () => {
    const theme = useTheme();
    const styles = getStyles(theme);
    return (React.createElement("div", { className: styles.labelWrapper },
        React.createElement(Tooltip, { interactive: true, placement: "top", theme: "info", content: React.createElement(ReadMoreLink, null) },
            React.createElement("h1", null,
                React.createElement(Icon, { name: 'info-circle' }),
                " ",
                Messages.labelText))));
};
//# sourceMappingURL=TechnicalPreview.js.map
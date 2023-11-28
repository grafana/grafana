import React from 'react';
import { Icon, Tooltip, useTheme } from '@grafana/ui';
import { getStyles } from './LinkTooltip.styles';
export const LinkTooltip = ({ tooltipContent, link, linkText, icon, dataTestId, target = '_blank', }) => {
    const theme = useTheme();
    const styles = getStyles(theme);
    return (React.createElement(Tooltip, { interactive: true, content: React.createElement("div", { className: styles.contentWrapper, "data-testid": dataTestId || 'info-tooltip' },
            typeof tooltipContent === 'string' ? React.createElement("span", null, tooltipContent) : tooltipContent,
            link && linkText && (React.createElement("a", { className: styles.link, href: link, target: target }, linkText))) },
        React.createElement("div", null,
            React.createElement(Icon, { name: icon }))));
};
//# sourceMappingURL=LinkTooltip.js.map
import React from 'react';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { getStyles } from './LinkTooltipCore.styles';
export const LinkTooltipCore = ({ tooltipText, tooltipLink, tooltipLinkText = 'Read more', tooltipIcon = 'info-circle', tooltipDataTestId, tooltipLinkTarget = '_blank', tooltipInteractive, }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(Tooltip, { content: React.createElement("div", { className: styles.contentWrapper },
            React.createElement("span", null, tooltipText),
            tooltipLink && (React.createElement("a", { className: styles.link, href: tooltipLink, target: tooltipLinkTarget }, tooltipLinkText))), "data-testid": tooltipDataTestId, interactive: !!tooltipLink ? true : !!tooltipInteractive },
        React.createElement("div", null,
            React.createElement(Icon, { name: tooltipIcon }))));
};
//# sourceMappingURL=LinkTooltipCore.js.map
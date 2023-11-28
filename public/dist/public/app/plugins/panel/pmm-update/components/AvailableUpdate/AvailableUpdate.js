import React from 'react';
import { useStyles, Icon, LinkButton, Tooltip } from '@grafana/ui';
import { useToggleOnAltClick } from '../../hooks';
import { Messages } from './AvailableUpdate.messages';
import { getStyles } from './AvailableUpdate.styles';
export const AvailableUpdate = ({ nextVersionDetails }) => {
    const styles = useStyles(getStyles);
    const [showFullVersion, handleToggleShowFullVersion] = useToggleOnAltClick(false);
    const { nextVersionDate, nextVersion, nextFullVersion, newsLink } = nextVersionDetails;
    return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    React.createElement("section", { "data-testid": "update-latest-section", className: styles.availableUpdate, onClick: handleToggleShowFullVersion },
        React.createElement("span", null,
            Messages.availableVersion,
            ":\u00A0",
            React.createElement("span", { "data-testid": "update-latest-version", className: styles.latestVersion }, showFullVersion ? nextFullVersion : nextVersion),
            React.createElement("span", { "data-testid": "update-latest-release-date", className: styles.releaseDate },
                "(",
                nextVersionDate,
                ")",
                React.createElement(Tooltip, { content: Messages.tooltip, "data-testid": "update-published-date-info" },
                    React.createElement(Icon, { name: "info-circle", className: styles.infoIcon }))),
            newsLink && (React.createElement(LinkButton, { "data-testid": "update-news-link", className: styles.whatsNewLink, rel: "noreferrer", href: newsLink, target: "_blank", fill: "text" }, Messages.whatsNew)))));
};
//# sourceMappingURL=AvailableUpdate.js.map
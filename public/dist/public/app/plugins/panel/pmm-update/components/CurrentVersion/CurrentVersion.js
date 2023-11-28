import React from 'react';
import { Icon, Tooltip, useStyles } from '@grafana/ui';
import { useToggleOnAltClick } from '../../hooks';
import { Messages } from './CurrentVersion.messages';
import { getStyles } from './CurrentVersion.styles';
export const CurrentVersion = ({ installedVersionDetails }) => {
    const styles = useStyles(getStyles);
    const [showFullVersion, handleToggleShowFullVersion] = useToggleOnAltClick(false);
    const { installedVersionDate, installedVersion, installedFullVersion } = installedVersionDetails;
    return (React.createElement("section", { className: styles.currentVersion },
        React.createElement("span", { onClick: handleToggleShowFullVersion },
            Messages.currentVersion,
            ":\u00A0",
            React.createElement("span", null,
                React.createElement("span", { "data-testid": "update-installed-version" }, showFullVersion ? installedFullVersion : installedVersion),
                "\u00A0",
                React.createElement("span", { "data-testid": "update-installed-release-date", className: styles.releaseDate }, !!installedVersionDate && (React.createElement(React.Fragment, null,
                    "(",
                    installedVersionDate,
                    ")",
                    React.createElement(Tooltip, { content: Messages.tooltip, "data-testid": "update-built-date-info" },
                        React.createElement(Icon, { name: "info-circle", className: styles.infoIcon })))))))));
};
//# sourceMappingURL=CurrentVersion.js.map
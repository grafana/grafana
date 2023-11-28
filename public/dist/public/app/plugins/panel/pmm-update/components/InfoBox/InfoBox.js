import React from 'react';
import { useStyles } from '@grafana/ui';
import { PMM_ADVANCED_SETTINGS_URL } from './InfoBox.constants';
import { Messages } from './InfoBox.messages';
import { getStyles } from './InfoBox.styles';
const UpdateInfo = ({ children }) => {
    const styles = useStyles(getStyles);
    return (React.createElement("section", { "data-testid": "updates-info", className: styles.infoBox }, children));
};
export const InfoBox = ({ upToDate = false, hasNoAccess, updatesDisabled, isOnline = true }) => {
    const styles = useStyles(getStyles);
    if (hasNoAccess) {
        return (React.createElement(UpdateInfo, null,
            React.createElement("p", null, Messages.noAccess)));
    }
    if (!isOnline) {
        return (React.createElement(UpdateInfo, null,
            React.createElement("p", null, Messages.notOnline)));
    }
    if (updatesDisabled) {
        return (React.createElement(UpdateInfo, null,
            React.createElement("p", { "data-testid": "updates-disabled" },
                Messages.updatesDisabled,
                React.createElement("a", { className: styles.link, href: PMM_ADVANCED_SETTINGS_URL }, Messages.pmmSettings))));
    }
    if (upToDate) {
        return (React.createElement(UpdateInfo, null,
            React.createElement("p", null, Messages.upToDate)));
    }
    return (React.createElement(UpdateInfo, null,
        React.createElement("p", null, Messages.noUpdates),
        React.createElement("p", null, Messages.updatesNotice)));
};
//# sourceMappingURL=InfoBox.js.map
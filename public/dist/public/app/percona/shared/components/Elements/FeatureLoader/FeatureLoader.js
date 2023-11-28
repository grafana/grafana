import React from 'react';
import { useStyles } from '@grafana/ui';
import { getPerconaUser } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';
import { PermissionLoader } from '../PermissionLoader';
import { PMM_SETTINGS_URL } from './FeatureLoader.constants';
import { Messages } from './FeatureLoader.messages';
import { getStyles } from './FeatureLoader.styles';
export const FeatureLoader = ({ featureName = '', featureSelector = () => true, messagedataTestId = 'settings-link', children, }) => {
    const { isAuthorized } = useSelector(getPerconaUser);
    const styles = useStyles(getStyles);
    if (isAuthorized === false) {
        return (React.createElement("div", { "data-testid": "unauthorized", className: styles.unauthorized }, Messages.unauthorized));
    }
    return (React.createElement(PermissionLoader, { featureSelector: featureSelector, renderSuccess: () => children, renderError: () => featureName ? (React.createElement(React.Fragment, null,
            Messages.featureDisabled(featureName),
            "\u00A0",
            featureName && (React.createElement("a", { "data-testid": messagedataTestId, className: styles.link, href: PMM_SETTINGS_URL }, Messages.pmmSettings)))) : (Messages.genericFeatureDisabled) }));
};
//# sourceMappingURL=FeatureLoader.js.map
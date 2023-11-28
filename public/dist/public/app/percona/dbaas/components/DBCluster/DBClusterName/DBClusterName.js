import React from 'react';
import { Icon, useStyles } from '@grafana/ui';
import { DASHBOARD_URL_MAP } from './DBClusterName.constants';
import { getStyles } from './DBClusterName.styles';
export const DBClusterName = ({ dbCluster: { clusterName, databaseType } }) => {
    const styles = useStyles(getStyles);
    const getDashboardUrl = DASHBOARD_URL_MAP[databaseType];
    return (React.createElement("div", { className: styles.clusterNameWrapper },
        React.createElement("span", null, clusterName),
        React.createElement("a", { href: getDashboardUrl(clusterName), target: "_blank", rel: "noreferrer noopener", className: styles.dashboardIcon },
            React.createElement(Icon, { name: "graph-bar" }))));
};
//# sourceMappingURL=DBClusterName.js.map
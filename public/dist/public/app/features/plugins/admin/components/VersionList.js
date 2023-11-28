import { css } from '@emotion/css';
import React from 'react';
import { dateTimeFormatTimeAgo } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { getLatestCompatibleVersion } from '../helpers';
export const VersionList = ({ versions = [], installedVersion }) => {
    const styles = useStyles2(getStyles);
    const latestCompatibleVersion = getLatestCompatibleVersion(versions);
    if (versions.length === 0) {
        return React.createElement("p", null, "No version history was found.");
    }
    return (React.createElement("table", { className: styles.table },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Version"),
                React.createElement("th", null, "Last updated"),
                React.createElement("th", null, "Grafana Dependency"))),
        React.createElement("tbody", null, versions.map((version) => {
            const isInstalledVersion = installedVersion === version.version;
            return (React.createElement("tr", { key: version.version },
                isInstalledVersion ? (React.createElement("td", { className: styles.currentVersion },
                    version.version,
                    " (installed version)")) : version.version === (latestCompatibleVersion === null || latestCompatibleVersion === void 0 ? void 0 : latestCompatibleVersion.version) ? (React.createElement("td", null,
                    version.version,
                    " (latest compatible version)")) : (React.createElement("td", null, version.version)),
                React.createElement("td", { className: isInstalledVersion ? styles.currentVersion : '' }, dateTimeFormatTimeAgo(version.createdAt)),
                React.createElement("td", { className: isInstalledVersion ? styles.currentVersion : '' }, version.grafanaDependency || 'N/A')));
        }))));
};
const getStyles = (theme) => ({
    container: css `
    padding: ${theme.spacing(2, 4, 3)};
  `,
    table: css `
    table-layout: fixed;
    width: 100%;
    td,
    th {
      padding: ${theme.spacing()} 0;
    }
    th {
      font-size: ${theme.typography.h5.fontSize};
    }
  `,
    currentVersion: css `
    font-weight: ${theme.typography.fontWeightBold};
  `,
});
//# sourceMappingURL=VersionList.js.map
import { css, cx } from '@emotion/css';
import React from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Alert, useTheme2, Link } from '@grafana/ui';
import { contextSrv } from '../../../core/core';
import { AccessControlAction } from '../../../types';
import { trackCreateDashboardClicked } from '../tracking';
const getStyles = (theme, hasTitle) => {
    return {
        content: css `
      color: ${theme.colors.text.secondary};
      padding-top: ${hasTitle ? theme.spacing(1) : 0};
      max-height: 50vh;
      overflow-y: auto;
    `,
        disabled: css `
      pointer-events: none;
      color: ${theme.colors.text.secondary};
    `,
    };
};
const AlertSuccessMessage = ({ title, exploreUrl, dataSourceId, onDashboardLinkClicked }) => {
    const theme = useTheme2();
    const hasTitle = Boolean(title);
    const styles = getStyles(theme, hasTitle);
    const canExploreDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);
    return (React.createElement("div", { className: styles.content },
        "Next, you can start to visualize data by",
        ' ',
        React.createElement(Link, { "aria-label": `Create a dashboard`, href: `/dashboard/new-with-ds/${dataSourceId}`, className: "external-link", onClick: onDashboardLinkClicked }, "building a dashboard"),
        ", or by querying data in the",
        ' ',
        React.createElement(Link, { "aria-label": `Explore data`, className: cx('external-link', {
                [`${styles.disabled}`]: !canExploreDataSources,
                'test-disabled': !canExploreDataSources,
            }), href: exploreUrl }, "Explore view"),
        "."));
};
AlertSuccessMessage.displayName = 'AlertSuccessMessage';
const alertVariants = new Set(['success', 'info', 'warning', 'error']);
const isAlertVariant = (str) => alertVariants.has(str);
const getAlertVariant = (status) => {
    if (status.toLowerCase() === 'ok') {
        return 'success';
    }
    return isAlertVariant(status) ? status : 'info';
};
export function DataSourceTestingStatus({ testingStatus, exploreUrl, dataSource }) {
    var _a, _b, _c;
    const severity = getAlertVariant((_a = testingStatus === null || testingStatus === void 0 ? void 0 : testingStatus.status) !== null && _a !== void 0 ? _a : 'error');
    const message = testingStatus === null || testingStatus === void 0 ? void 0 : testingStatus.message;
    const detailsMessage = (_b = testingStatus === null || testingStatus === void 0 ? void 0 : testingStatus.details) === null || _b === void 0 ? void 0 : _b.message;
    const detailsVerboseMessage = (_c = testingStatus === null || testingStatus === void 0 ? void 0 : testingStatus.details) === null || _c === void 0 ? void 0 : _c.verboseMessage;
    const onDashboardLinkClicked = () => {
        trackCreateDashboardClicked({
            grafana_version: config.buildInfo.version,
            datasource_uid: dataSource.uid,
            plugin_name: dataSource.typeName,
            path: location.pathname,
        });
    };
    if (message) {
        return (React.createElement("div", { className: "gf-form-group p-t-2" },
            React.createElement(Alert, { severity: severity, title: message, "aria-label": e2eSelectors.pages.DataSource.alert }, (testingStatus === null || testingStatus === void 0 ? void 0 : testingStatus.details) && (React.createElement(React.Fragment, null,
                detailsMessage,
                severity === 'success' ? (React.createElement(AlertSuccessMessage, { title: message, exploreUrl: exploreUrl, dataSourceId: dataSource.uid, onDashboardLinkClicked: onDashboardLinkClicked })) : null,
                detailsVerboseMessage ? (React.createElement("details", { style: { whiteSpace: 'pre-wrap' } }, String(detailsVerboseMessage))) : null)))));
    }
    return null;
}
//# sourceMappingURL=DataSourceTestingStatus.js.map
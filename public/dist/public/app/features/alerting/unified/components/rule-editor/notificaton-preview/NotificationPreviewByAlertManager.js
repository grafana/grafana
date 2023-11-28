import { css } from '@emotion/css';
import React from 'react';
import { Alert, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';
import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { NotificationRoute } from './NotificationRoute';
import { useAlertmanagerNotificationRoutingPreview } from './useAlertmanagerNotificationRoutingPreview';
function NotificationPreviewByAlertManager({ alertManagerSource, potentialInstances, onlyOneAM, }) {
    const styles = useStyles2(getStyles);
    const { routesByIdMap, receiversByName, matchingMap, loading, error } = useAlertmanagerNotificationRoutingPreview(alertManagerSource.name, potentialInstances);
    if (error) {
        return (React.createElement(Alert, { title: "Cannot load Alertmanager configuration", severity: "error" }, error.message));
    }
    if (loading) {
        return React.createElement(LoadingPlaceholder, { text: "Loading routing preview..." });
    }
    const matchingPoliciesFound = matchingMap.size > 0;
    return matchingPoliciesFound ? (React.createElement("div", { className: styles.alertManagerRow },
        !onlyOneAM && (React.createElement(Stack, { direction: "row", alignItems: "center" },
            React.createElement("div", { className: styles.firstAlertManagerLine }),
            React.createElement("div", { className: styles.alertManagerName },
                ' ',
                "Alert manager:",
                React.createElement("img", { src: alertManagerSource.img, alt: "", className: styles.img }),
                alertManagerSource.name),
            React.createElement("div", { className: styles.secondAlertManagerLine }))),
        React.createElement(Stack, { gap: 1, direction: "column" }, Array.from(matchingMap.entries()).map(([routeId, instanceMatches]) => {
            const route = routesByIdMap.get(routeId);
            const receiver = (route === null || route === void 0 ? void 0 : route.receiver) && receiversByName.get(route.receiver);
            if (!route) {
                return null;
            }
            if (!receiver) {
                throw new Error('Receiver not found');
            }
            return (React.createElement(NotificationRoute, { instanceMatches: instanceMatches, route: route, receiver: receiver, key: routeId, routesByIdMap: routesByIdMap, alertManagerSourceName: alertManagerSource.name }));
        })))) : null;
}
// export default because we want to load the component dynamically using React.lazy
// Due to loading of the web worker we don't want to load this component when not necessary
export default withErrorBoundary(NotificationPreviewByAlertManager);
const getStyles = (theme) => ({
    alertManagerRow: css `
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
    width: 100%;
  `,
    firstAlertManagerLine: css `
    height: 1px;
    width: ${theme.spacing(4)};
    background-color: ${theme.colors.secondary.main};
  `,
    alertManagerName: css `
    width: fit-content;
  `,
    secondAlertManagerLine: css `
    height: 1px;
    width: 100%;
    flex: 1;
    background-color: ${theme.colors.secondary.main};
  `,
    img: css `
    margin-left: ${theme.spacing(2)};
    width: ${theme.spacing(3)};
    height: ${theme.spacing(3)};
    margin-right: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=NotificationPreviewByAlertManager.js.map
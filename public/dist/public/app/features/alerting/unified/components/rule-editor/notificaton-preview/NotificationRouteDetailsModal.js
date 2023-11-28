import { css, cx } from '@emotion/css';
import { compact } from 'lodash';
import React from 'react';
import { Button, Icon, Modal, useStyles2 } from '@grafana/ui';
import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { AlertmanagerAction } from '../../../hooks/useAbilities';
import { AlertmanagerProvider } from '../../../state/AlertmanagerContext';
import { GRAFANA_DATASOURCE_NAME } from '../../../utils/datasource';
import { makeAMLink } from '../../../utils/misc';
import { Authorize } from '../../Authorize';
import { Matchers } from '../../notification-policies/Matchers';
import { hasEmptyMatchers, isDefaultPolicy } from './route';
function PolicyPath({ route, routesByIdMap }) {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const routePathIds = (_b = (_a = route.path) === null || _a === void 0 ? void 0 : _a.slice(1)) !== null && _b !== void 0 ? _b : [];
    const routePathObjects = [...compact(routePathIds.map((id) => routesByIdMap.get(id))), route];
    return (React.createElement("div", { className: styles.policyPathWrapper },
        React.createElement("div", { className: styles.defaultPolicy }, "Default policy"),
        routePathObjects.map((pathRoute, index) => {
            var _a;
            return (React.createElement("div", { key: pathRoute.id },
                React.createElement("div", { className: styles.policyInPath(index, index === routePathObjects.length - 1) }, hasEmptyMatchers(pathRoute) ? (React.createElement("div", { className: styles.textMuted }, "No matchers")) : (React.createElement(Matchers, { matchers: (_a = pathRoute.object_matchers) !== null && _a !== void 0 ? _a : [] })))));
        })));
}
export function NotificationRouteDetailsModal({ onClose, route, receiver, routesByIdMap, alertManagerSourceName, }) {
    const styles = useStyles2(getStyles);
    const isDefault = isDefaultPolicy(route);
    return (React.createElement(AlertmanagerProvider, { accessType: "notification", alertmanagerSourceName: GRAFANA_DATASOURCE_NAME },
        React.createElement(Modal, { className: styles.detailsModal, isOpen: true, title: "Routing details", onDismiss: onClose, onClickBackdrop: onClose },
            React.createElement(Stack, { gap: 0, direction: "column" },
                React.createElement("div", { className: cx(styles.textMuted, styles.marginBottom(2)) }, "Your alert instances are routed as follows."),
                React.createElement("div", null, "Notification policy path"),
                isDefault && React.createElement("div", { className: styles.textMuted }, "Default policy"),
                React.createElement("div", { className: styles.separator(1) }),
                !isDefault && (React.createElement(React.Fragment, null,
                    React.createElement(PolicyPath, { route: route, routesByIdMap: routesByIdMap }))),
                React.createElement("div", { className: styles.separator(4) }),
                React.createElement("div", { className: styles.contactPoint },
                    React.createElement(Stack, { gap: 1, direction: "row", alignItems: "center" },
                        "Contact point:",
                        React.createElement("span", { className: styles.textMuted }, receiver.name)),
                    React.createElement(Authorize, { actions: [AlertmanagerAction.UpdateContactPoint] },
                        React.createElement(Stack, { gap: 1, direction: "row", alignItems: "center" },
                            React.createElement("a", { href: makeAMLink(`/alerting/notifications/receivers/${encodeURIComponent(receiver.name)}/edit`, alertManagerSourceName), className: styles.link, target: "_blank", rel: "noreferrer" },
                                "See details ",
                                React.createElement(Icon, { name: "external-link-alt" }))))),
                React.createElement("div", { className: styles.button },
                    React.createElement(Button, { variant: "primary", type: "button", onClick: onClose }, "Close"))))));
}
const getStyles = (theme) => ({
    textMuted: css `
    color: ${theme.colors.text.secondary};
  `,
    link: css `
    display: block;
    color: ${theme.colors.text.link};
  `,
    button: css `
    justify-content: flex-end;
    display: flex;
  `,
    detailsModal: css `
    max-width: 560px;
  `,
    defaultPolicy: css `
    padding: ${theme.spacing(0.5)};
    background: ${theme.colors.background.secondary};
    width: fit-content;
  `,
    contactPoint: css `
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${theme.spacing(1)};
  `,
    policyPathWrapper: css `
    display: flex;
    flex-direction: column;
    margin-top: ${theme.spacing(1)};
  `,
    separator: (units) => css `
    margin-top: ${theme.spacing(units)};
  `,
    marginBottom: (units) => css `
    margin-bottom: ${theme.spacing(theme.spacing(units))};
  `,
    policyInPath: (index = 0, higlight = false) => css `
    margin-left: ${30 + index * 30}px;
    padding: ${theme.spacing(1)};
    margin-top: ${theme.spacing(1)};
    border: solid 1px ${theme.colors.border.weak};
    background: ${theme.colors.background.secondary};
    width: fit-content;
    position: relative;

    ${higlight &&
        css `
        border: solid 1px ${theme.colors.info.border};
      `},
    &:before {
      content: '';
      position: absolute;
      height: calc(100% - 10px);
      width: ${theme.spacing(1)};
      border-left: solid 1px ${theme.colors.border.weak};
      border-bottom: solid 1px ${theme.colors.border.weak};
      margin-top: ${theme.spacing(-2)};
      margin-left: -17px;
    }
  }  `,
});
//# sourceMappingURL=NotificationRouteDetailsModal.js.map
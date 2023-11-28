import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import pluralize from 'pluralize';
import React, { useState } from 'react';
import { useToggle } from 'react-use';
import { Button, getTagColorIndexFromName, TagList, useStyles2 } from '@grafana/ui';
import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { CollapseToggle } from '../../CollapseToggle';
import { MetaText } from '../../MetaText';
import { Spacer } from '../../Spacer';
import { NotificationPolicyMatchers } from './NotificationPolicyMatchers';
import { NotificationRouteDetailsModal } from './NotificationRouteDetailsModal';
function NotificationRouteHeader({ route, receiver, routesByIdMap, instancesCount, alertManagerSourceName, expandRoute, onExpandRouteClick, }) {
    const styles = useStyles2(getStyles);
    const [showDetails, setShowDetails] = useState(false);
    const onClickDetails = () => {
        setShowDetails(true);
    };
    // @TODO: re-use component ContactPointsHoverDetails from Policy once we have it for cloud AMs.
    return (React.createElement("div", { className: styles.routeHeader },
        React.createElement(CollapseToggle, { isCollapsed: !expandRoute, onToggle: (isCollapsed) => onExpandRouteClick(!isCollapsed), "aria-label": "Expand policy route" }),
        React.createElement(Stack, { flexGrow: 1, gap: 1 },
            React.createElement("div", { onClick: () => onExpandRouteClick(!expandRoute), className: styles.expandable },
                React.createElement(Stack, { gap: 1, direction: "row", alignItems: "center" },
                    "Notification policy",
                    React.createElement(NotificationPolicyMatchers, { route: route }))),
            React.createElement(Spacer, null),
            React.createElement(Stack, { gap: 2, direction: "row", alignItems: "center" },
                React.createElement(MetaText, { icon: "layers-alt", "data-testid": "matching-instances" }, instancesCount !== null && instancesCount !== void 0 ? instancesCount : '-',
                    React.createElement("span", null, pluralize('instance', instancesCount))),
                React.createElement(Stack, { gap: 1, direction: "row", alignItems: "center" },
                    React.createElement("div", null,
                        React.createElement("span", { className: styles.textMuted }, "@ Delivered to"),
                        " ",
                        receiver.name),
                    React.createElement("div", { className: styles.verticalBar }),
                    React.createElement(Button, { type: "button", onClick: onClickDetails, variant: "secondary", fill: "outline", size: "sm" }, "See details")))),
        showDetails && (React.createElement(NotificationRouteDetailsModal, { onClose: () => setShowDetails(false), route: route, receiver: receiver, routesByIdMap: routesByIdMap, alertManagerSourceName: alertManagerSourceName }))));
}
export function NotificationRoute({ route, instanceMatches, receiver, routesByIdMap, alertManagerSourceName, }) {
    const styles = useStyles2(getStyles);
    const [expandRoute, setExpandRoute] = useToggle(false);
    // @TODO: The color index might be updated at some point in the future.Maybe we should roll our own tag component,
    // one that supports a custom function to define the color and allow manual color overrides
    const GREY_COLOR_INDEX = 9;
    return (React.createElement("div", { "data-testid": "matching-policy-route" },
        React.createElement(NotificationRouteHeader, { route: route, receiver: receiver, routesByIdMap: routesByIdMap, instancesCount: instanceMatches.length, alertManagerSourceName: alertManagerSourceName, expandRoute: expandRoute, onExpandRouteClick: setExpandRoute }),
        expandRoute && (React.createElement(Stack, { gap: 1, direction: "column" },
            React.createElement("div", { className: styles.routeInstances, "data-testid": "route-matching-instance" }, instanceMatches.map((instanceMatch) => {
                const matchArray = Array.from(instanceMatch.labelsMatch);
                let matchResult = matchArray.map(([label, matchResult]) => ({
                    label: `${label[0]}=${label[1]}`,
                    match: matchResult.match,
                    colorIndex: matchResult.match ? getTagColorIndexFromName(label[0]) : GREY_COLOR_INDEX,
                }));
                const matchingLabels = matchResult.filter((mr) => mr.match);
                const nonMatchingLabels = matchResult.filter((mr) => !mr.match);
                return (React.createElement("div", { className: styles.tagListCard, key: uniqueId() }, matchArray.length > 0 ? (React.createElement(React.Fragment, null,
                    matchingLabels.length > 0 ? (React.createElement(TagList, { tags: matchingLabels.map((mr) => mr.label), className: styles.labelList, getColorIndex: (_, index) => matchingLabels[index].colorIndex })) : (React.createElement("div", { className: cx(styles.textMuted, styles.textItalic) }, "No matching labels")),
                    React.createElement("div", { className: styles.labelSeparator }),
                    React.createElement(TagList, { tags: nonMatchingLabels.map((mr) => mr.label), className: styles.labelList, getColorIndex: (_, index) => nonMatchingLabels[index].colorIndex }))) : (React.createElement("div", { className: styles.textMuted }, "No labels"))));
            }))))));
}
const getStyles = (theme) => ({
    textMuted: css `
    color: ${theme.colors.text.secondary};
  `,
    textItalic: css `
    font-style: italic;
  `,
    expandable: css `
    cursor: pointer;
  `,
    routeHeader: css `
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
    align-items: center;
    border-bottom: 1px solid ${theme.colors.border.weak};
    &:hover {
      background-color: ${theme.components.table.rowHoverBackground};
    }
    padding: ${theme.spacing(0.5, 0.5, 0.5, 0)};
  `,
    labelList: css `
    flex: 0 1 auto;
    justify-content: flex-start;
  `,
    labelSeparator: css `
    width: 1px;
    background-color: ${theme.colors.border.weak};
  `,
    tagListCard: css `
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(2)};

    position: relative;
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1)};

    border-radius: ${theme.shape.borderRadius(2)};
    border: solid 1px ${theme.colors.border.weak};
  `,
    routeInstances: css `
    padding: ${theme.spacing(1, 0, 1, 4)};
    position: relative;

    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};

    &:before {
      content: '';
      position: absolute;
      left: ${theme.spacing(2)};
      height: calc(100% - ${theme.spacing(2)});
      width: ${theme.spacing(4)};
      border-left: solid 1px ${theme.colors.border.weak};
    }
  `,
    verticalBar: css `
    width: 1px;
    height: 20px;
    background-color: ${theme.colors.secondary.main};
    margin-left: ${theme.spacing(1)};
    margin-right: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=NotificationRoute.js.map
import { cx } from '@emotion/css';
import React from 'react';
import { Icon, useStyles } from '@grafana/ui';
import { Messages } from './ResourcesBar.messages';
import { getStyles } from './ResourcesBar.styles';
import { formatResources, getExpectedAllocated, getExpectedAllocatedWidth, getResourcesWidth, } from './ResourcesBar.utils';
export const ResourcesBar = ({ total, allocated, expected, resourceLabel, resourceEmptyValueMessage, icon, dataTestId, className, }) => {
    const styles = useStyles(getStyles);
    const requiredResources = allocated && expected ? allocated.original + expected.original : undefined;
    const allocatedWidth = getResourcesWidth(allocated === null || allocated === void 0 ? void 0 : allocated.original, total === null || total === void 0 ? void 0 : total.original);
    const expectedWidth = getResourcesWidth(requiredResources, total === null || total === void 0 ? void 0 : total.original);
    const expectedAllocatedWidth = getExpectedAllocatedWidth(expected, allocated);
    const expectedAllocated = getExpectedAllocated(expected, allocated);
    const isDownsize = expected && expected.value < 0;
    const isResourceInsufficient = requiredResources && total ? requiredResources > total.original : false;
    const expectedSquareStyles = {
        [styles.expectedSquare]: !isDownsize,
        [styles.expectedAllocatedSquare]: isDownsize,
    };
    return (React.createElement("div", { "data-testid": dataTestId, className: cx(styles.resourcesBarWrapper, className) },
        React.createElement("div", { "data-testid": "resources-bar-icon", className: styles.iconWrapper }, icon),
        React.createElement("div", { className: styles.resourcesBarContent },
            React.createElement("div", { "data-testid": "resources-bar", className: styles.resourcesBarBackground },
                isResourceInsufficient ? (React.createElement("div", { className: cx(styles.filled, styles.filledInsufficient, styles.getFilledStyles(100)) })) : (!isDownsize && (React.createElement("div", { className: cx(styles.filled, styles.filledExpected, styles.getFilledStyles(expectedWidth)) }))),
                allocated && (React.createElement("div", { className: cx(styles.filled, styles.filledAllocated, styles.getFilledStyles(allocatedWidth)) }, isDownsize && (React.createElement("div", { className: cx(styles.filled, styles.filledExpectedAllocated, styles.getFilledStyles(expectedAllocatedWidth)) }))))),
            allocated && total && (React.createElement("span", { "data-testid": "resources-bar-label", className: styles.resourcesBarLabel }, Messages.buildResourcesLabel(formatResources(allocated), allocatedWidth, formatResources(total), resourceEmptyValueMessage))),
            allocated && (React.createElement("div", { className: styles.captionWrapper },
                React.createElement("div", { className: cx(styles.captionSquare, styles.allocatedSquare) }),
                React.createElement("span", { "data-testid": "resources-bar-allocated-caption", className: styles.captionLabel }, Messages.buildAllocatedLabel(resourceLabel)))),
            expected && expected.value !== 0 && !isResourceInsufficient && (React.createElement("div", { className: styles.captionWrapper },
                React.createElement("div", { className: cx(styles.captionSquare, expectedSquareStyles) }),
                React.createElement("span", { "data-testid": "resources-bar-expected-caption", className: styles.captionLabel }, isDownsize
                    ? Messages.buildExpectedAllocatedLabel(formatResources(expectedAllocated), resourceLabel)
                    : Messages.buildExpectedLabel(formatResources(expected), resourceLabel)))),
            expected && isResourceInsufficient && (React.createElement("div", { className: styles.captionWrapper },
                React.createElement(Icon, { className: styles.insufficientIcon, name: "exclamation-triangle" }),
                React.createElement("span", { "data-testid": "resources-bar-insufficient-resources", className: styles.captionLabel }, Messages.buildInsufficientLabel(formatResources(expected), resourceLabel)))))));
};
//# sourceMappingURL=ResourcesBar.js.map
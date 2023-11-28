import { css } from '@emotion/css';
import cx from 'classnames';
import React, { memo } from 'react';
import tinycolor from 'tinycolor2';
import { getFieldColorModeForField } from '@grafana/data';
import { Icon, useTheme2 } from '@grafana/ui';
import { statToString } from './utils';
export const nodeR = 40;
const getStyles = (theme, hovering) => ({
    mainGroup: css `
    cursor: pointer;
    font-size: 10px;
    transition: opacity 300ms;
    opacity: ${hovering === 'inactive' ? 0.5 : 1};
  `,
    mainCircle: css `
    fill: ${theme.components.panel.background};
  `,
    hoverCircle: css `
    opacity: 0.5;
    fill: transparent;
    stroke: ${theme.colors.primary.text};
  `,
    text: css `
    fill: ${theme.colors.text.primary};
    pointer-events: none;
  `,
    titleText: css `
    text-align: center;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    background-color: ${tinycolor(theme.colors.background.primary).setAlpha(0.6).toHex8String()};
    width: 140px;
  `,
    statsText: css `
    text-align: center;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    width: 70px;
  `,
    textHovering: css `
    width: 200px;
    & span {
      background-color: ${tinycolor(theme.colors.background.primary).setAlpha(0.8).toHex8String()};
    }
  `,
    clickTarget: css `
    fill: none;
    stroke: none;
    pointer-events: fill;
  `,
});
export const Node = memo(function Node(props) {
    var _a;
    const { node, onMouseEnter, onMouseLeave, onClick, hovering } = props;
    const theme = useTheme2();
    const styles = getStyles(theme, hovering);
    const isHovered = hovering === 'active';
    const nodeRadius = ((_a = node.nodeRadius) === null || _a === void 0 ? void 0 : _a.values[node.dataFrameRowIndex]) || nodeR;
    if (!(node.x !== undefined && node.y !== undefined)) {
        return null;
    }
    return (React.createElement("g", { "data-node-id": node.id, className: styles.mainGroup, "aria-label": `Node: ${node.title}` },
        React.createElement("circle", { "data-testid": `node-circle-${node.id}`, className: styles.mainCircle, r: nodeRadius, cx: node.x, cy: node.y }),
        isHovered && (React.createElement("circle", { className: styles.hoverCircle, r: nodeRadius - 3, cx: node.x, cy: node.y, strokeWidth: 2 })),
        React.createElement(ColorCircle, { node: node }),
        React.createElement("g", { className: styles.text, style: { pointerEvents: 'none' } },
            React.createElement(NodeContents, { node: node, hovering: hovering }),
            React.createElement("foreignObject", { x: node.x - (isHovered ? 100 : 70), y: node.y + nodeRadius + 5, width: isHovered ? '200' : '140', height: "40" },
                React.createElement("div", { className: cx(styles.titleText, isHovered && styles.textHovering) },
                    React.createElement("span", null, node.title),
                    React.createElement("br", null),
                    React.createElement("span", null, node.subTitle)))),
        React.createElement("rect", { "data-testid": `node-click-rect-${node.id}`, onMouseEnter: () => {
                onMouseEnter(node.id);
            }, onMouseLeave: () => {
                onMouseLeave(node.id);
            }, onClick: (event) => {
                onClick(event, node);
            }, className: styles.clickTarget, x: node.x - nodeRadius - 5, y: node.y - nodeRadius - 5, width: nodeRadius * 2 + 10, height: nodeRadius * 2 + 50 })));
});
/**
 * Shows contents of the node which can be either an Icon or a main and secondary stat values.
 */
function NodeContents({ node, hovering }) {
    const theme = useTheme2();
    const styles = getStyles(theme, hovering);
    const isHovered = hovering === 'active';
    if (!(node.x !== undefined && node.y !== undefined)) {
        return null;
    }
    return node.icon ? (React.createElement("foreignObject", { x: node.x - 35, y: node.y - 20, width: "70", height: "40" },
        React.createElement("div", { style: { width: 70, overflow: 'hidden', display: 'flex', justifyContent: 'center', marginTop: -4 } },
            React.createElement(Icon, { "data-testid": `node-icon-${node.icon}`, name: node.icon, size: 'xxxl' })))) : (React.createElement("foreignObject", { x: node.x - (isHovered ? 100 : 35), y: node.y - 15, width: isHovered ? '200' : '70', height: "40" },
        React.createElement("div", { className: cx(styles.statsText, isHovered && styles.textHovering) },
            React.createElement("span", null, node.mainStat && statToString(node.mainStat.config, node.mainStat.values[node.dataFrameRowIndex])),
            React.createElement("br", null),
            React.createElement("span", null, node.secondaryStat &&
                statToString(node.secondaryStat.config, node.secondaryStat.values[node.dataFrameRowIndex])))));
}
/**
 * Shows the outer segmented circle with different colors based on the supplied data.
 */
function ColorCircle(props) {
    var _a, _b;
    const { node } = props;
    const fullStat = node.arcSections.find((s) => s.values[node.dataFrameRowIndex] >= 1);
    const theme = useTheme2();
    const nodeRadius = ((_a = node.nodeRadius) === null || _a === void 0 ? void 0 : _a.values[node.dataFrameRowIndex]) || nodeR;
    if (fullStat) {
        // Doing arc with path does not work well so it's better to just do a circle in that case
        return (React.createElement("circle", { fill: "none", stroke: theme.visualization.getColorByName(((_b = fullStat.config.color) === null || _b === void 0 ? void 0 : _b.fixedColor) || ''), strokeWidth: 2, r: nodeRadius, cx: node.x, cy: node.y }));
    }
    const nonZero = node.arcSections.filter((s) => s.values[node.dataFrameRowIndex] !== 0);
    if (nonZero.length === 0) {
        // Fallback if no arc is defined
        return (React.createElement("circle", { fill: "none", stroke: node.color ? getColor(node.color, node.dataFrameRowIndex, theme) : 'gray', strokeWidth: 2, r: nodeRadius, cx: node.x, cy: node.y }));
    }
    const { elements } = nonZero.reduce((acc, section, index) => {
        var _a;
        const color = ((_a = section.config.color) === null || _a === void 0 ? void 0 : _a.fixedColor) || '';
        const value = section.values[node.dataFrameRowIndex];
        const el = (React.createElement(ArcSection, { key: index, r: nodeRadius, x: node.x, y: node.y, startPercent: acc.percent, percent: value + acc.percent > 1
                ? // If the values aren't correct and add up to more than 100% lets still render correctly the amounts we
                    // already have and cap it at 100%
                    1 - acc.percent
                : value, color: theme.visualization.getColorByName(color), strokeWidth: 2 }));
        acc.elements.push(el);
        acc.percent = acc.percent + value;
        return acc;
    }, { elements: [], percent: 0 });
    return React.createElement(React.Fragment, null, elements);
}
function ArcSection({ r, x, y, startPercent, percent, color, strokeWidth = 2, }) {
    const endPercent = startPercent + percent;
    const startXPos = x + Math.sin(2 * Math.PI * startPercent) * r;
    const startYPos = y - Math.cos(2 * Math.PI * startPercent) * r;
    const endXPos = x + Math.sin(2 * Math.PI * endPercent) * r;
    const endYPos = y - Math.cos(2 * Math.PI * endPercent) * r;
    const largeArc = percent > 0.5 ? '1' : '0';
    return (React.createElement("path", { fill: "none", d: `M ${startXPos} ${startYPos} A ${r} ${r} 0 ${largeArc} 1 ${endXPos} ${endYPos}`, stroke: color, strokeWidth: strokeWidth }));
}
function getColor(field, index, theme) {
    if (!field.config.color) {
        return field.values[index];
    }
    return getFieldColorModeForField(field).getCalculator(field, theme)(0, field.values[index]);
}
//# sourceMappingURL=Node.js.map
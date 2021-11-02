import { __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import cx from 'classnames';
import { getFieldColorModeForField } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { css } from 'emotion';
import tinycolor from 'tinycolor2';
import { statToString } from './utils';
var nodeR = 40;
var getStyles = function (theme) { return ({
    mainGroup: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    cursor: pointer;\n    font-size: 10px;\n  "], ["\n    cursor: pointer;\n    font-size: 10px;\n  "]))),
    mainCircle: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    fill: ", ";\n  "], ["\n    fill: ", ";\n  "])), theme.components.panel.background),
    hoverCircle: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    opacity: 0.5;\n    fill: transparent;\n    stroke: ", ";\n  "], ["\n    opacity: 0.5;\n    fill: transparent;\n    stroke: ", ";\n  "])), theme.colors.primary.text),
    text: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    fill: ", ";\n  "], ["\n    fill: ", ";\n  "])), theme.colors.text.primary),
    titleText: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    text-align: center;\n    text-overflow: ellipsis;\n    overflow: hidden;\n    white-space: nowrap;\n    background-color: ", ";\n    width: 100px;\n  "], ["\n    text-align: center;\n    text-overflow: ellipsis;\n    overflow: hidden;\n    white-space: nowrap;\n    background-color: ", ";\n    width: 100px;\n  "])), tinycolor(theme.colors.background.primary).setAlpha(0.6).toHex8String()),
    statsText: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    text-align: center;\n    text-overflow: ellipsis;\n    overflow: hidden;\n    white-space: nowrap;\n    width: 70px;\n  "], ["\n    text-align: center;\n    text-overflow: ellipsis;\n    overflow: hidden;\n    white-space: nowrap;\n    width: 70px;\n  "]))),
    textHovering: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    width: 200px;\n    & span {\n      background-color: ", ";\n    }\n  "], ["\n    width: 200px;\n    & span {\n      background-color: ", ";\n    }\n  "])), tinycolor(theme.colors.background.primary).setAlpha(0.8).toHex8String()),
}); };
export var Node = memo(function Node(props) {
    var node = props.node, onMouseEnter = props.onMouseEnter, onMouseLeave = props.onMouseLeave, onClick = props.onClick, hovering = props.hovering;
    var styles = useStyles2(getStyles);
    if (!(node.x !== undefined && node.y !== undefined)) {
        return null;
    }
    return (React.createElement("g", { "data-node-id": node.id, className: styles.mainGroup, onMouseEnter: function () {
            onMouseEnter(node.id);
        }, onMouseLeave: function () {
            onMouseLeave(node.id);
        }, onClick: function (event) {
            onClick(event, node);
        }, "aria-label": "Node: " + node.title },
        React.createElement("circle", { className: styles.mainCircle, r: nodeR, cx: node.x, cy: node.y }),
        hovering && React.createElement("circle", { className: styles.hoverCircle, r: nodeR - 3, cx: node.x, cy: node.y, strokeWidth: 2 }),
        React.createElement(ColorCircle, { node: node }),
        React.createElement("g", { className: styles.text },
            React.createElement("foreignObject", { x: node.x - (hovering ? 100 : 35), y: node.y - 15, width: hovering ? '200' : '70', height: "30" },
                React.createElement("div", { className: cx(styles.statsText, hovering && styles.textHovering) },
                    React.createElement("span", null, node.mainStat && statToString(node.mainStat, node.dataFrameRowIndex)),
                    React.createElement("br", null),
                    React.createElement("span", null, node.secondaryStat && statToString(node.secondaryStat, node.dataFrameRowIndex)))),
            React.createElement("foreignObject", { x: node.x - (hovering ? 100 : 50), y: node.y + nodeR + 5, width: hovering ? '200' : '100', height: "30" },
                React.createElement("div", { className: cx(styles.titleText, hovering && styles.textHovering) },
                    React.createElement("span", null, node.title),
                    React.createElement("br", null),
                    React.createElement("span", null, node.subTitle))))));
});
/**
 * Shows the outer segmented circle with different colors based on the supplied data.
 */
function ColorCircle(props) {
    var _a;
    var node = props.node;
    var fullStat = node.arcSections.find(function (s) { return s.values.get(node.dataFrameRowIndex) === 1; });
    var theme = useTheme2();
    if (fullStat) {
        // Doing arc with path does not work well so it's better to just do a circle in that case
        return (React.createElement("circle", { fill: "none", stroke: theme.visualization.getColorByName(((_a = fullStat.config.color) === null || _a === void 0 ? void 0 : _a.fixedColor) || ''), strokeWidth: 2, r: nodeR, cx: node.x, cy: node.y }));
    }
    var nonZero = node.arcSections.filter(function (s) { return s.values.get(node.dataFrameRowIndex) !== 0; });
    if (nonZero.length === 0) {
        // Fallback if no arc is defined
        return (React.createElement("circle", { fill: "none", stroke: node.color ? getColor(node.color, node.dataFrameRowIndex, theme) : 'gray', strokeWidth: 2, r: nodeR, cx: node.x, cy: node.y }));
    }
    var elements = nonZero.reduce(function (acc, section) {
        var _a;
        var color = ((_a = section.config.color) === null || _a === void 0 ? void 0 : _a.fixedColor) || '';
        var value = section.values.get(node.dataFrameRowIndex);
        var el = (React.createElement(ArcSection, { key: color, r: nodeR, x: node.x, y: node.y, startPercent: acc.percent, percent: value, color: theme.visualization.getColorByName(color), strokeWidth: 2 }));
        acc.elements.push(el);
        acc.percent = acc.percent + value;
        return acc;
    }, { elements: [], percent: 0 }).elements;
    return React.createElement(React.Fragment, null, elements);
}
function ArcSection(_a) {
    var r = _a.r, x = _a.x, y = _a.y, startPercent = _a.startPercent, percent = _a.percent, color = _a.color, _b = _a.strokeWidth, strokeWidth = _b === void 0 ? 2 : _b;
    var endPercent = startPercent + percent;
    var startXPos = x + Math.sin(2 * Math.PI * startPercent) * r;
    var startYPos = y - Math.cos(2 * Math.PI * startPercent) * r;
    var endXPos = x + Math.sin(2 * Math.PI * endPercent) * r;
    var endYPos = y - Math.cos(2 * Math.PI * endPercent) * r;
    var largeArc = percent > 0.5 ? '1' : '0';
    return (React.createElement("path", { fill: "none", d: "M " + startXPos + " " + startYPos + " A " + r + " " + r + " 0 " + largeArc + " 1 " + endXPos + " " + endYPos, stroke: color, strokeWidth: strokeWidth }));
}
function getColor(field, index, theme) {
    if (!field.config.color) {
        return field.values.get(index);
    }
    return getFieldColorModeForField(field).getCalculator(field, theme)(0, field.values.get(index));
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=Node.js.map
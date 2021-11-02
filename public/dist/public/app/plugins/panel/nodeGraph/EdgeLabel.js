import { __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { shortenLine } from './utils';
var getStyles = function (theme) {
    return {
        mainGroup: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      pointer-events: none;\n      font-size: 8px;\n    "], ["\n      pointer-events: none;\n      font-size: 8px;\n    "]))),
        background: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      fill: ", ";\n    "], ["\n      fill: ", ";\n    "])), theme.components.tooltip.background),
        text: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      fill: ", ";\n    "], ["\n      fill: ", ";\n    "])), theme.components.tooltip.text),
    };
};
export var EdgeLabel = memo(function EdgeLabel(props) {
    var edge = props.edge;
    // Not great typing but after we do layout these properties are full objects not just references
    var _a = edge, source = _a.source, target = _a.target;
    // As the nodes have some radius we want edges to end outside of the node circle.
    var line = shortenLine({
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
    }, 90);
    var middle = {
        x: line.x1 + (line.x2 - line.x1) / 2,
        y: line.y1 + (line.y2 - line.y1) / 2,
    };
    var styles = useStyles2(getStyles);
    return (React.createElement("g", { className: styles.mainGroup },
        React.createElement("rect", { className: styles.background, x: middle.x - 40, y: middle.y - 15, width: "80", height: "30", rx: "5" }),
        React.createElement("text", { className: styles.text, x: middle.x, y: middle.y - 5, textAnchor: 'middle' }, edge.mainStat),
        React.createElement("text", { className: styles.text, x: middle.x, y: middle.y + 10, textAnchor: 'middle' }, edge.secondaryStat)));
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=EdgeLabel.js.map
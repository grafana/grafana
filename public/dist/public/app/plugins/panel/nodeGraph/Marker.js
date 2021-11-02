import { __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
var nodeR = 40;
var getStyles = stylesFactory(function (theme) { return ({
    mainGroup: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    cursor: pointer;\n    font-size: 10px;\n  "], ["\n    cursor: pointer;\n    font-size: 10px;\n  "]))),
    mainCircle: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    fill: ", ";\n    stroke: ", ";\n  "], ["\n    fill: ", ";\n    stroke: ", ";\n  "])), theme.colors.panelBg, theme.colors.border3),
    text: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    width: 50px;\n    height: 50px;\n    text-align: center;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n  "], ["\n    width: 50px;\n    height: 50px;\n    text-align: center;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n  "]))),
}); });
export var Marker = memo(function Marker(props) {
    var marker = props.marker, onClick = props.onClick;
    var node = marker.node;
    var styles = getStyles(useTheme());
    if (!(node.x !== undefined && node.y !== undefined)) {
        return null;
    }
    return (React.createElement("g", { "data-node-id": node.id, className: styles.mainGroup, onClick: function (event) {
            onClick === null || onClick === void 0 ? void 0 : onClick(event, marker);
        }, "aria-label": "Hidden nodes marker: " + node.id },
        React.createElement("circle", { className: styles.mainCircle, r: nodeR, cx: node.x, cy: node.y }),
        React.createElement("g", null,
            React.createElement("foreignObject", { x: node.x - 25, y: node.y - 25, width: "50", height: "50" },
                React.createElement("div", { className: styles.text },
                    React.createElement("span", null,
                        marker.count > 100 ? '>100' : marker.count,
                        " nodes"))))));
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=Marker.js.map
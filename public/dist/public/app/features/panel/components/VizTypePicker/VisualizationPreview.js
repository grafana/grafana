import { __makeTemplateObject } from "tslib";
import React from 'react';
import { PanelRenderer } from '../PanelRenderer';
import { css } from '@emotion/css';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { cloneDeep } from 'lodash';
import { selectors } from '@grafana/e2e-selectors';
export function VisualizationPreview(_a) {
    var data = _a.data, suggestion = _a.suggestion, onChange = _a.onChange, width = _a.width, showTitle = _a.showTitle;
    var styles = useStyles2(getStyles);
    var _b = getPreviewDimensionsAndStyles(width), innerStyles = _b.innerStyles, outerStyles = _b.outerStyles, renderWidth = _b.renderWidth, renderHeight = _b.renderHeight;
    var onClick = function () {
        onChange({
            pluginId: suggestion.pluginId,
            options: suggestion.options,
            fieldConfig: suggestion.fieldConfig,
        });
    };
    var preview = suggestion;
    if (suggestion.previewModifier) {
        preview = cloneDeep(suggestion);
        suggestion.previewModifier(preview);
    }
    return (React.createElement("div", null,
        showTitle && React.createElement("div", { className: styles.name }, suggestion.name),
        React.createElement("button", { "aria-label": suggestion.name, className: styles.vizBox, "data-testid": selectors.components.VisualizationPreview.card(suggestion.name), style: outerStyles, onClick: onClick },
            React.createElement(Tooltip, { content: suggestion.name },
                React.createElement("div", { style: innerStyles, className: styles.renderContainer },
                    React.createElement(PanelRenderer, { title: "", data: data, pluginId: suggestion.pluginId, width: renderWidth, height: renderHeight, options: preview.options, fieldConfig: preview.fieldConfig }),
                    React.createElement("div", { className: styles.hoverPane }))))));
}
var getStyles = function (theme) {
    return {
        hoverPane: css({
            position: 'absolute',
            top: 0,
            right: 0,
            left: 0,
            borderRadius: theme.spacing(2),
            bottom: 0,
        }),
        vizBox: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: relative;\n      background: none;\n      border-radius: ", ";\n      cursor: pointer;\n      border: 1px solid ", ";\n\n      transition: ", ";\n\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      position: relative;\n      background: none;\n      border-radius: ", ";\n      cursor: pointer;\n      border: 1px solid ", ";\n\n      transition: ", ";\n\n      &:hover {\n        background: ", ";\n      }\n    "])), theme.shape.borderRadius(1), theme.colors.border.strong, theme.transitions.create(['background'], {
            duration: theme.transitions.duration.short,
        }), theme.colors.background.secondary),
        name: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      font-size: ", ";\n      white-space: nowrap;\n      overflow: hidden;\n      color: ", ";\n      font-weight: ", ";\n      text-overflow: ellipsis;\n    "], ["\n      font-size: ", ";\n      white-space: nowrap;\n      overflow: hidden;\n      color: ", ";\n      font-weight: ", ";\n      text-overflow: ellipsis;\n    "])), theme.typography.bodySmall.fontSize, theme.colors.text.secondary, theme.typography.fontWeightMedium),
        renderContainer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      position: absolute;\n      transform-origin: left top;\n      top: 6px;\n      left: 6px;\n    "], ["\n      position: absolute;\n      transform-origin: left top;\n      top: 6px;\n      left: 6px;\n    "]))),
    };
};
function getPreviewDimensionsAndStyles(width) {
    var aspectRatio = 16 / 10;
    var showWidth = width;
    var showHeight = width * (1 / aspectRatio);
    var renderWidth = 350;
    var renderHeight = renderWidth * (1 / aspectRatio);
    var padding = 6;
    var widthFactor = (showWidth - padding * 2) / renderWidth;
    var heightFactor = (showHeight - padding * 2) / renderHeight;
    return {
        renderHeight: renderHeight,
        renderWidth: renderWidth,
        outerStyles: { width: showWidth, height: showHeight },
        innerStyles: {
            width: renderWidth,
            height: renderHeight,
            transform: "scale(" + widthFactor + ", " + heightFactor + ")",
        },
    };
}
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=VisualizationPreview.js.map
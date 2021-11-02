import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { usePopper } from 'react-popper';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2, Portal, DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { colorManipulator, getDisplayProcessor } from '@grafana/data';
import { getCommonAnnotationStyles } from '../styles';
import { AnnotationEditorForm } from './AnnotationEditorForm';
export var AnnotationEditor = function (_a) {
    var onDismiss = _a.onDismiss, onSave = _a.onSave, timeZone = _a.timeZone, data = _a.data, selection = _a.selection, annotation = _a.annotation, style = _a.style;
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    var commonStyles = useStyles2(getCommonAnnotationStyles);
    var _b = __read(useState(null), 2), popperTrigger = _b[0], setPopperTrigger = _b[1];
    var _c = __read(useState(null), 2), editorPopover = _c[0], setEditorPopover = _c[1];
    var popper = usePopper(popperTrigger, editorPopover, {
        modifiers: [
            { name: 'arrow', enabled: false },
            {
                name: 'preventOverflow',
                enabled: true,
                options: {
                    rootBoundary: 'viewport',
                },
            },
        ],
    });
    var xField = data.fields[0];
    if (!xField) {
        return null;
    }
    var xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone: timeZone, theme: theme });
    var isRegionAnnotation = selection.min !== selection.max;
    return (React.createElement(Portal, null,
        React.createElement(React.Fragment, null,
            React.createElement("div", { style: style },
                React.createElement("div", { className: cx(css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                position: absolute;\n                top: ", "px;\n                left: ", "px;\n                width: ", "px;\n                height: ", "px;\n              "], ["\n                position: absolute;\n                top: ", "px;\n                left: ", "px;\n                width: ", "px;\n                height: ", "px;\n              "])), selection.bbox.top, selection.bbox.left, selection.bbox.width, selection.bbox.height), isRegionAnnotation ? styles.overlayRange(annotation) : styles.overlay(annotation)) },
                    React.createElement("div", { ref: setPopperTrigger, className: isRegionAnnotation
                            ? cx(commonStyles(annotation).markerBar, styles.markerBar)
                            : cx(commonStyles(annotation).markerTriangle, styles.markerTriangle) }))),
            React.createElement(AnnotationEditorForm, __assign({ annotation: annotation || { time: selection.min, timeEnd: selection.max }, timeFormatter: function (v) { return xFieldFmt(v).text; }, onSave: onSave, onDismiss: onDismiss, ref: setEditorPopover, style: popper.styles.popper }, popper.attributes.popper)))));
};
var getStyles = function (theme) {
    return {
        overlay: function (annotation) {
            var color = theme.visualization.getColorByName((annotation === null || annotation === void 0 ? void 0 : annotation.color) || DEFAULT_ANNOTATION_COLOR);
            return css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        border-left: 1px dashed ", ";\n      "], ["\n        border-left: 1px dashed ", ";\n      "])), color);
        },
        overlayRange: function (annotation) {
            var color = theme.visualization.getColorByName((annotation === null || annotation === void 0 ? void 0 : annotation.color) || DEFAULT_ANNOTATION_COLOR);
            return css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        background: ", ";\n        border-left: 1px dashed ", ";\n        border-right: 1px dashed ", ";\n      "], ["\n        background: ", ";\n        border-left: 1px dashed ", ";\n        border-right: 1px dashed ", ";\n      "])), colorManipulator.alpha(color, 0.1), color, color);
        },
        markerTriangle: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      top: calc(100% + 2px);\n      left: -4px;\n      position: absolute;\n    "], ["\n      top: calc(100% + 2px);\n      left: -4px;\n      position: absolute;\n    "]))),
        markerBar: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      top: 100%;\n      left: 0;\n      position: absolute;\n    "], ["\n      top: 100%;\n      left: 0;\n      position: absolute;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=AnnotationEditor.js.map
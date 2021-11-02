import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
export var getCommonAnnotationStyles = function (theme) {
    return function (annotation) {
        var color = theme.visualization.getColorByName((annotation === null || annotation === void 0 ? void 0 : annotation.color) || DEFAULT_ANNOTATION_COLOR);
        return {
            markerTriangle: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        width: 0;\n        height: 0;\n        border-left: 4px solid transparent;\n        border-right: 4px solid transparent;\n        border-bottom: 4px solid ", ";\n      "], ["\n        width: 0;\n        height: 0;\n        border-left: 4px solid transparent;\n        border-right: 4px solid transparent;\n        border-bottom: 4px solid ", ";\n      "])), color),
            markerBar: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        display: block;\n        width: calc(100%);\n        height: 5px;\n        background: ", ";\n      "], ["\n        display: block;\n        width: calc(100%);\n        height: 5px;\n        background: ", ";\n      "])), color),
        };
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=styles.js.map
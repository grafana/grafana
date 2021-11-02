import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Well } from './Well';
import { css } from '@emotion/css';
import { Tooltip, useStyles } from '@grafana/ui';
import { DetailsField } from './DetailsField';
import { annotationLabels } from '../utils/constants';
var wellableAnnotationKeys = ['message', 'description'];
export var AnnotationDetailsField = function (_a) {
    var annotationKey = _a.annotationKey, value = _a.value;
    var label = annotationLabels[annotationKey] ? (React.createElement(Tooltip, { content: annotationKey, placement: "top", theme: "info" },
        React.createElement("span", null, annotationLabels[annotationKey]))) : (annotationKey);
    return (React.createElement(DetailsField, { label: label, horizontal: true },
        React.createElement(AnnotationValue, { annotationKey: annotationKey, value: value })));
};
var AnnotationValue = function (_a) {
    var annotationKey = _a.annotationKey, value = _a.value;
    var styles = useStyles(getStyles);
    if (wellableAnnotationKeys.includes(annotationKey)) {
        return React.createElement(Well, null, value);
    }
    else if (value && value.startsWith('http')) {
        return (React.createElement("a", { href: value, target: "__blank", className: styles.link }, value));
    }
    return React.createElement(React.Fragment, null, value);
};
export var getStyles = function (theme) { return ({
    well: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    word-break: break-all;\n  "], ["\n    word-break: break-all;\n  "]))),
    link: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    word-break: break-all;\n    color: ", ";\n  "], ["\n    word-break: break-all;\n    color: ", ";\n  "])), theme.colors.textBlue),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=AnnotationDetailsField.js.map
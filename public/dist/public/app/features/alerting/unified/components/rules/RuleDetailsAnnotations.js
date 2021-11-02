import { __makeTemplateObject, __read } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
export function RuleDetailsAnnotations(props) {
    var annotations = props.annotations;
    var styles = useStyles2(getStyles);
    if (annotations.length === 0) {
        return null;
    }
    return (React.createElement("div", { className: styles.annotations }, annotations.map(function (_a) {
        var _b = __read(_a, 2), key = _b[0], value = _b[1];
        return (React.createElement(AnnotationDetailsField, { key: key, annotationKey: key, value: value }));
    })));
}
var getStyles = function () { return ({
    annotations: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: 46px;\n  "], ["\n    margin-top: 46px;\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=RuleDetailsAnnotations.js.map
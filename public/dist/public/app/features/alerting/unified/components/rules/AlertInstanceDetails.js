import { __read } from "tslib";
import React from 'react';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
import { DetailsField } from '../DetailsField';
export var AlertInstanceDetails = function (_a) {
    var instance = _a.instance;
    var annotations = (Object.entries(instance.annotations || {}) || []).filter(function (_a) {
        var _b = __read(_a, 2), _ = _b[0], value = _b[1];
        return !!value.trim();
    });
    return (React.createElement("div", null,
        instance.value && (React.createElement(DetailsField, { label: "Value", horizontal: true }, instance.value)),
        annotations.map(function (_a) {
            var _b = __read(_a, 2), key = _b[0], value = _b[1];
            return (React.createElement(AnnotationDetailsField, { key: key, annotationKey: key, value: value }));
        })));
};
//# sourceMappingURL=AlertInstanceDetails.js.map
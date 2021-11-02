import { __assign, __rest } from "tslib";
import React, { useMemo } from 'react';
import { SelectWithAdd } from './SelectWIthAdd';
import { Annotation, annotationLabels } from '../../utils/constants';
export var AnnotationKeyInput = function (_a) {
    var value = _a.value, existingKeys = _a.existingKeys, rest = __rest(_a, ["value", "existingKeys"]);
    var annotationOptions = useMemo(function () {
        return Object.values(Annotation)
            .filter(function (key) { return !existingKeys.includes(key); }) // remove keys already taken in other annotations
            .map(function (key) { return ({ value: key, label: annotationLabels[key] }); });
    }, [existingKeys]);
    return (React.createElement(SelectWithAdd, __assign({ value: value, options: annotationOptions, custom: !!value && !Object.values(Annotation).includes(value) }, rest)));
};
//# sourceMappingURL=AnnotationKeyInput.js.map
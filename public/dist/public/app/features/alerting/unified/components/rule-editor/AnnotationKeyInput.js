import { __rest } from "tslib";
import React, { useMemo } from 'react';
import { Annotation, annotationLabels } from '../../utils/constants';
import { SelectWithAdd } from './SelectWIthAdd';
export const AnnotationKeyInput = (_a) => {
    var { value, existingKeys, 'aria-label': ariaLabel } = _a, rest = __rest(_a, ["value", "existingKeys", 'aria-label']);
    const annotationOptions = useMemo(() => Object.values(Annotation)
        .filter((key) => !existingKeys.includes(key)) // remove keys already taken in other annotations
        .map((key) => ({ value: key, label: annotationLabels[key] })), [existingKeys]);
    return (React.createElement(SelectWithAdd, Object.assign({ "aria-label": ariaLabel, value: value, options: annotationOptions, custom: !!value && !Object.values(Annotation).includes(value) }, rest)));
};
//# sourceMappingURL=AnnotationKeyInput.js.map
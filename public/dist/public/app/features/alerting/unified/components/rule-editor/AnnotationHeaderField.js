import { __rest } from "tslib";
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Stack } from '@grafana/experimental';
import { InputControl, Text } from '@grafana/ui';
import { Annotation, annotationDescriptions, annotationLabels } from '../../utils/constants';
import CustomAnnotationHeaderField from './CustomAnnotationHeaderField';
const AnnotationHeaderField = ({ annotationField, annotations, annotation, index, }) => {
    var _a;
    const { control } = useFormContext();
    return (React.createElement(Stack, { direction: "column", gap: 0 },
        React.createElement("label", null, React.createElement(InputControl, { name: `annotations.${index}.key`, defaultValue: annotationField.key, render: (_a) => {
                var _b = _a.field, { ref } = _b, field = __rest(_b, ["ref"]);
                if (!annotationLabels[annotation]) {
                    return React.createElement(CustomAnnotationHeaderField, { field: field });
                }
                let label;
                switch (annotationField.key) {
                    case Annotation.dashboardUID:
                        label = 'Dashboard and panel';
                    case Annotation.panelID:
                        label = '';
                    default:
                        label = annotationLabels[annotation] && annotationLabels[annotation] + ' (optional)';
                }
                return (React.createElement("span", { "data-testid": `annotation-key-${index}` },
                    React.createElement(Text, { color: "primary", variant: "bodySmall" }, label)));
            }, control: control, rules: { required: { value: !!((_a = annotations[index]) === null || _a === void 0 ? void 0 : _a.value), message: 'Required.' } } })),
        React.createElement(Text, { variant: "bodySmall", color: "secondary" }, annotationDescriptions[annotation])));
};
export default AnnotationHeaderField;
//# sourceMappingURL=AnnotationHeaderField.js.map
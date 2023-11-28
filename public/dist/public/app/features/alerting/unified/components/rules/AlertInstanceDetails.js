import React from 'react';
import { useAnnotationLinks, useCleanAnnotations } from '../../utils/annotations';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
import { DetailsField } from '../DetailsField';
export const AlertInstanceDetails = ({ instance }) => {
    const annotations = useCleanAnnotations(instance.annotations);
    const annotationLinks = useAnnotationLinks(annotations);
    return (React.createElement("div", null,
        instance.value && (React.createElement(DetailsField, { label: "Value", horizontal: true }, instance.value)),
        annotations.map(([key, value]) => {
            return (React.createElement(AnnotationDetailsField, { key: key, annotationKey: key, value: value, valueLink: annotationLinks.get(key) }));
        })));
};
//# sourceMappingURL=AlertInstanceDetails.js.map
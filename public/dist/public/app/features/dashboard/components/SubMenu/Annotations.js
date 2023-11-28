import React, { useEffect, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { AnnotationPicker } from './AnnotationPicker';
export const Annotations = ({ annotations, onAnnotationChanged, events }) => {
    const [visibleAnnotations, setVisibleAnnotations] = useState([]);
    useEffect(() => {
        setVisibleAnnotations(annotations.filter((annotation) => annotation.hide !== true));
    }, [annotations]);
    if (visibleAnnotations.length === 0) {
        return null;
    }
    return (React.createElement("div", { "data-testid": selectors.pages.Dashboard.SubMenu.Annotations.annotationsWrapper }, visibleAnnotations.map((annotation) => (React.createElement(AnnotationPicker, { events: events, annotation: annotation, onEnabledChanged: onAnnotationChanged, key: annotation.name })))));
};
//# sourceMappingURL=Annotations.js.map
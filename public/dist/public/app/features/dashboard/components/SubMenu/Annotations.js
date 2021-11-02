import { __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { AnnotationPicker } from './AnnotationPicker';
export var Annotations = function (_a) {
    var annotations = _a.annotations, onAnnotationChanged = _a.onAnnotationChanged, events = _a.events;
    var _b = __read(useState([]), 2), visibleAnnotations = _b[0], setVisibleAnnotations = _b[1];
    useEffect(function () {
        setVisibleAnnotations(annotations.filter(function (annotation) { return annotation.hide !== true; }));
    }, [annotations]);
    if (visibleAnnotations.length === 0) {
        return null;
    }
    return (React.createElement(React.Fragment, null, visibleAnnotations.map(function (annotation) { return (React.createElement(AnnotationPicker, { events: events, annotation: annotation, onEnabledChanged: onAnnotationChanged, key: annotation.name })); })));
};
//# sourceMappingURL=Annotations.js.map
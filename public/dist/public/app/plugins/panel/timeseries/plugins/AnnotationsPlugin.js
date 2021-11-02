import { __values } from "tslib";
import { colorManipulator, DataFrameView } from '@grafana/data';
import { EventsCanvas, useTheme2 } from '@grafana/ui';
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { AnnotationMarker } from './annotations/AnnotationMarker';
export var AnnotationsPlugin = function (_a) {
    var annotations = _a.annotations, timeZone = _a.timeZone, config = _a.config;
    var theme = useTheme2();
    var plotInstance = useRef();
    var annotationsRef = useRef();
    // Update annotations views when new annotations came
    useEffect(function () {
        var e_1, _a;
        var views = [];
        try {
            for (var annotations_1 = __values(annotations), annotations_1_1 = annotations_1.next(); !annotations_1_1.done; annotations_1_1 = annotations_1.next()) {
                var frame = annotations_1_1.value;
                views.push(new DataFrameView(frame));
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (annotations_1_1 && !annotations_1_1.done && (_a = annotations_1.return)) _a.call(annotations_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        annotationsRef.current = views;
    }, [annotations]);
    useLayoutEffect(function () {
        config.addHook('init', function (u) {
            plotInstance.current = u;
        });
        config.addHook('draw', function (u) {
            // Render annotation lines on the canvas
            /**
             * We cannot rely on state value here, as it would require this effect to be dependent on the state value.
             */
            if (!annotationsRef.current) {
                return null;
            }
            var ctx = u.ctx;
            if (!ctx) {
                return;
            }
            ctx.save();
            ctx.beginPath();
            ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
            ctx.clip();
            var renderLine = function (x, color) {
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = color;
                ctx.setLineDash([5, 5]);
                ctx.moveTo(x, u.bbox.top);
                ctx.lineTo(x, u.bbox.top + u.bbox.height);
                ctx.stroke();
                ctx.closePath();
            };
            for (var i = 0; i < annotationsRef.current.length; i++) {
                var annotationsView = annotationsRef.current[i];
                for (var j = 0; j < annotationsView.length; j++) {
                    var annotation = annotationsView.get(j);
                    if (!annotation.time) {
                        continue;
                    }
                    var x0 = u.valToPos(annotation.time, 'x', true);
                    var color = theme.visualization.getColorByName(annotation.color);
                    renderLine(x0, color);
                    if (annotation.isRegion && annotation.timeEnd) {
                        var x1 = u.valToPos(annotation.timeEnd, 'x', true);
                        renderLine(x1, color);
                        ctx.fillStyle = colorManipulator.alpha(color, 0.1);
                        ctx.rect(x0, u.bbox.top, x1 - x0, u.bbox.height);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
            return;
        });
    }, [config, theme]);
    var mapAnnotationToXYCoords = useCallback(function (frame, dataFrameFieldIndex) {
        var view = new DataFrameView(frame);
        var annotation = view.get(dataFrameFieldIndex.fieldIndex);
        if (!annotation.time || !plotInstance.current) {
            return undefined;
        }
        var x = plotInstance.current.valToPos(annotation.time, 'x');
        if (x < 0) {
            x = 0;
        }
        return {
            x: x,
            y: plotInstance.current.bbox.height / window.devicePixelRatio + 4,
        };
    }, []);
    var renderMarker = useCallback(function (frame, dataFrameFieldIndex) {
        var markerStyle;
        var view = new DataFrameView(frame);
        var annotation = view.get(dataFrameFieldIndex.fieldIndex);
        var isRegionAnnotation = Boolean(annotation.isRegion);
        if (isRegionAnnotation && plotInstance.current) {
            var x0 = plotInstance.current.valToPos(annotation.time, 'x');
            var x1 = plotInstance.current.valToPos(annotation.timeEnd, 'x');
            // markers are rendered relatively to uPlot canvas overly, not caring about axes width
            if (x0 < 0) {
                x0 = 0;
            }
            if (x1 > plotInstance.current.bbox.width / window.devicePixelRatio) {
                x1 = plotInstance.current.bbox.width / window.devicePixelRatio;
            }
            markerStyle = { width: x1 - x0 + "px" };
        }
        return React.createElement(AnnotationMarker, { annotation: annotation, timeZone: timeZone, style: markerStyle });
    }, [timeZone]);
    return (React.createElement(EventsCanvas, { id: "annotations", config: config, events: annotations, renderEventMarker: renderMarker, mapEventToXYCoords: mapAnnotationToXYCoords }));
};
//# sourceMappingURL=AnnotationsPlugin.js.map
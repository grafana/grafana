import { __assign, __read } from "tslib";
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMountedState } from 'react-use';
import { Marker } from './Marker';
import { XYCanvas } from './XYCanvas';
export function EventsCanvas(_a) {
    var id = _a.id, events = _a.events, renderEventMarker = _a.renderEventMarker, mapEventToXYCoords = _a.mapEventToXYCoords, config = _a.config;
    var plotInstance = useRef();
    // render token required to re-render annotation markers. Rendering lines happens in uPlot and the props do not change
    // so we need to force the re-render when the draw hook was performed by uPlot
    var _b = __read(useState(0), 2), renderToken = _b[0], setRenderToken = _b[1];
    var isMounted = useMountedState();
    useLayoutEffect(function () {
        config.addHook('init', function (u) {
            plotInstance.current = u;
        });
        config.addHook('draw', function () {
            if (!isMounted()) {
                return;
            }
            setRenderToken(function (s) { return s + 1; });
        });
    }, [config, setRenderToken]);
    var eventMarkers = useMemo(function () {
        var markers = [];
        if (!plotInstance.current || events.length === 0) {
            return markers;
        }
        for (var i = 0; i < events.length; i++) {
            var frame = events[i];
            for (var j = 0; j < frame.length; j++) {
                var coords = mapEventToXYCoords(frame, { fieldIndex: j, frameIndex: i });
                if (!coords) {
                    continue;
                }
                markers.push(React.createElement(Marker, __assign({}, coords, { key: id + "-marker-" + i + "-" + j }), renderEventMarker(frame, { fieldIndex: j, frameIndex: i })));
            }
        }
        return React.createElement(React.Fragment, null, markers);
    }, [events, renderEventMarker, renderToken]);
    if (!plotInstance.current) {
        return null;
    }
    return (React.createElement(XYCanvas, { left: plotInstance.current.bbox.left / window.devicePixelRatio, top: plotInstance.current.bbox.top / window.devicePixelRatio }, eventMarkers));
}
//# sourceMappingURL=EventsCanvas.js.map
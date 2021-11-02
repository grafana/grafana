import { __read } from "tslib";
import { useCallback, useEffect, useRef, useState } from 'react';
var defaultOptions = {
    stepDown: function (s) { return s / 1.5; },
    stepUp: function (s) { return s * 1.5; },
    min: 0.13,
    max: 2.25,
};
/**
 * Keeps state and returns handlers that can be used to implement zooming functionality ideally by using it with
 * 'transform: scale'. It returns handler for manual buttons with zoom in/zoom out function and a ref that can be
 * used to zoom in/out with mouse wheel.
 */
export function useZoom(_a) {
    var _b = _a === void 0 ? defaultOptions : _a, stepUp = _b.stepUp, stepDown = _b.stepDown, min = _b.min, max = _b.max;
    var ref = useRef(null);
    var _c = __read(useState(1), 2), scale = _c[0], setScale = _c[1];
    var onStepUp = useCallback(function () {
        if (scale < (max !== null && max !== void 0 ? max : Infinity)) {
            setScale(stepUp(scale));
        }
    }, [scale, stepUp, max]);
    var onStepDown = useCallback(function () {
        if (scale > (min !== null && min !== void 0 ? min : -Infinity)) {
            setScale(stepDown(scale));
        }
    }, [scale, stepDown, min]);
    var onWheel = useCallback(function (event) {
        // Seems like typing for the addEventListener is lacking a bit
        var wheelEvent = event;
        // Only do this with special key pressed similar to how google maps work.
        // TODO: I would guess this won't work very well with touch right now
        if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
            event.preventDefault();
            setScale(Math.min(Math.max(min !== null && min !== void 0 ? min : -Infinity, scale + Math.min(wheelEvent.deltaY, 2) * -0.01), max !== null && max !== void 0 ? max : Infinity));
            if (wheelEvent.deltaY < 0) {
                var newScale = scale + Math.max(wheelEvent.deltaY, -4) * -0.015;
                setScale(Math.max(min !== null && min !== void 0 ? min : -Infinity, newScale));
            }
            else if (wheelEvent.deltaY > 0) {
                var newScale = scale + Math.min(wheelEvent.deltaY, 4) * -0.015;
                setScale(Math.min(max !== null && max !== void 0 ? max : Infinity, newScale));
            }
        }
    }, [min, max, scale]);
    useEffect(function () {
        if (!ref.current) {
            return;
        }
        var zoomRef = ref.current;
        // Adds listener for wheel event, we need the passive: false to be able to prevent default otherwise that
        // cannot be used with passive listeners.
        zoomRef.addEventListener('wheel', onWheel, { passive: false });
        return function () {
            if (zoomRef) {
                zoomRef.removeEventListener('wheel', onWheel);
            }
        };
    }, [onWheel]);
    return {
        onStepUp: onStepUp,
        onStepDown: onStepDown,
        scale: Math.max(Math.min(scale, max !== null && max !== void 0 ? max : Infinity), min !== null && min !== void 0 ? min : -Infinity),
        isMax: scale >= (max !== null && max !== void 0 ? max : Infinity),
        isMin: scale <= (min !== null && min !== void 0 ? min : -Infinity),
        ref: ref,
    };
}
//# sourceMappingURL=useZoom.js.map
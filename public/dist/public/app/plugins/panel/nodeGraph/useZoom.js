import { useCallback, useEffect, useRef, useState } from 'react';
const defaultOptions = {
    stepDown: (s) => s / 1.5,
    stepUp: (s) => s * 1.5,
    min: 0.13,
    max: 2.25,
};
/**
 * Keeps state and returns handlers that can be used to implement zooming functionality ideally by using it with
 * 'transform: scale'. It returns handler for manual buttons with zoom in/zoom out function and a ref that can be
 * used to zoom in/out with mouse wheel.
 */
export function useZoom({ stepUp, stepDown, min, max } = defaultOptions) {
    const ref = useRef(null);
    const [scale, setScale] = useState(1);
    const onStepUp = useCallback(() => {
        if (scale < (max !== null && max !== void 0 ? max : Infinity)) {
            setScale(stepUp(scale));
        }
    }, [scale, stepUp, max]);
    const onStepDown = useCallback(() => {
        if (scale > (min !== null && min !== void 0 ? min : -Infinity)) {
            setScale(stepDown(scale));
        }
    }, [scale, stepDown, min]);
    const onWheel = useCallback(function (wheelEvent) {
        // Seems like typing for the addEventListener is lacking a bit
        // Only do this with special key pressed similar to how google maps work.
        // TODO: I would guess this won't work very well with touch right now
        if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
            wheelEvent.preventDefault();
            setScale(Math.min(Math.max(min !== null && min !== void 0 ? min : -Infinity, scale + Math.min(wheelEvent.deltaY, 2) * -0.01), max !== null && max !== void 0 ? max : Infinity));
            if (wheelEvent.deltaY < 0) {
                const newScale = scale + Math.max(wheelEvent.deltaY, -4) * -0.015;
                setScale(Math.max(min !== null && min !== void 0 ? min : -Infinity, newScale));
            }
            else if (wheelEvent.deltaY > 0) {
                const newScale = scale + Math.min(wheelEvent.deltaY, 4) * -0.015;
                setScale(Math.min(max !== null && max !== void 0 ? max : Infinity, newScale));
            }
        }
    }, [min, max, scale]);
    useEffect(() => {
        if (!ref.current) {
            return;
        }
        const zoomRef = ref.current;
        // Adds listener for wheel event, we need the passive: false to be able to prevent default otherwise that
        // cannot be used with passive listeners.
        zoomRef.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            if (zoomRef) {
                zoomRef.removeEventListener('wheel', onWheel);
            }
        };
    }, [onWheel]);
    return {
        onStepUp,
        onStepDown,
        scale: Math.max(Math.min(scale, max !== null && max !== void 0 ? max : Infinity), min !== null && min !== void 0 ? min : -Infinity),
        isMax: scale >= (max !== null && max !== void 0 ? max : Infinity),
        isMin: scale <= (min !== null && min !== void 0 ? min : -Infinity),
        ref,
    };
}
//# sourceMappingURL=useZoom.js.map
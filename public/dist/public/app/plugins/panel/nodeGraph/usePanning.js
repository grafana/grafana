import { __assign, __read } from "tslib";
import { useEffect, useRef, useState, useMemo } from 'react';
import useMountedState from 'react-use/lib/useMountedState';
import usePrevious from 'react-use/lib/usePrevious';
/**
 * Based on https://github.com/streamich/react-use/blob/master/src/useSlider.ts
 * Returns position x/y coordinates which can be directly used in transform: translate().
 * @param scale - Can be used when we want to scale the movement if we are moving a scaled element. We need to do it
 *   here because we don't want to change the pos when scale changes.
 * @param bounds - If set the panning cannot go outside of those bounds.
 * @param focus - Position to focus on.
 */
export function usePanning(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.scale, scale = _c === void 0 ? 1 : _c, bounds = _b.bounds, focus = _b.focus;
    var isMounted = useMountedState();
    var isPanning = useRef(false);
    var frame = useRef(0);
    var panRef = useRef(null);
    var initial = { x: 0, y: 0 };
    // As we return a diff of the view port to be applied we need as translate coordinates we have to invert the
    // bounds of the content to get the bounds of the view port diff.
    var viewBounds = useMemo(function () { return ({
        right: bounds ? -bounds.left : Infinity,
        left: bounds ? -bounds.right : -Infinity,
        bottom: bounds ? -bounds.top : -Infinity,
        top: bounds ? -bounds.bottom : Infinity,
    }); }, [bounds]);
    // We need to keep some state so we can compute the position diff and add that to the previous position.
    var startMousePosition = useRef(initial);
    var prevPosition = useRef(initial);
    // We cannot use the state as that would rerun the effect on each state change which we don't want so we have to keep
    // separate variable for the state that won't cause useEffect eval
    var currentPosition = useRef(initial);
    var _d = __read(useState({
        isPanning: false,
        position: initial,
    }), 2), state = _d[0], setState = _d[1];
    useEffect(function () {
        var startPanning = function (event) {
            if (!isPanning.current && isMounted()) {
                isPanning.current = true;
                // Snapshot the current position of both mouse pointer and the element
                startMousePosition.current = getEventXY(event);
                prevPosition.current = __assign({}, currentPosition.current);
                setState(function (state) { return (__assign(__assign({}, state), { isPanning: true })); });
                bindEvents();
            }
        };
        var stopPanning = function () {
            if (isPanning.current && isMounted()) {
                isPanning.current = false;
                setState(function (state) { return (__assign(__assign({}, state), { isPanning: false })); });
                unbindEvents();
            }
        };
        var onPanStart = function (event) {
            startPanning(event);
            onPan(event);
        };
        var bindEvents = function () {
            document.addEventListener('mousemove', onPan);
            document.addEventListener('mouseup', stopPanning);
            document.addEventListener('touchmove', onPan);
            document.addEventListener('touchend', stopPanning);
        };
        var unbindEvents = function () {
            document.removeEventListener('mousemove', onPan);
            document.removeEventListener('mouseup', stopPanning);
            document.removeEventListener('touchmove', onPan);
            document.removeEventListener('touchend', stopPanning);
        };
        var onPan = function (event) {
            cancelAnimationFrame(frame.current);
            var pos = getEventXY(event);
            frame.current = requestAnimationFrame(function () {
                if (isMounted() && panRef.current) {
                    // Get the diff by which we moved the mouse.
                    var xDiff = pos.x - startMousePosition.current.x;
                    var yDiff = pos.y - startMousePosition.current.y;
                    // Add the diff to the position from the moment we started panning.
                    currentPosition.current = {
                        x: inBounds(prevPosition.current.x + xDiff / scale, viewBounds.left, viewBounds.right),
                        y: inBounds(prevPosition.current.y + yDiff / scale, viewBounds.top, viewBounds.bottom),
                    };
                    setState(function (state) { return (__assign(__assign({}, state), { position: __assign({}, currentPosition.current) })); });
                }
            });
        };
        var ref = panRef.current;
        if (ref) {
            ref.addEventListener('mousedown', onPanStart);
            ref.addEventListener('touchstart', onPanStart);
        }
        return function () {
            if (ref) {
                ref.removeEventListener('mousedown', onPanStart);
                ref.removeEventListener('touchstart', onPanStart);
            }
        };
    }, [scale, viewBounds, isMounted]);
    var previousFocus = usePrevious(focus);
    // We need to update the state in case need to focus on something but we want to do it only once when the focus
    // changes to something new.
    useEffect(function () {
        if (focus && (previousFocus === null || previousFocus === void 0 ? void 0 : previousFocus.x) !== focus.x && (previousFocus === null || previousFocus === void 0 ? void 0 : previousFocus.y) !== focus.y) {
            var position_1 = {
                x: inBounds(focus.x, viewBounds.left, viewBounds.right),
                y: inBounds(focus.y, viewBounds.top, viewBounds.bottom),
            };
            setState({
                position: position_1,
                isPanning: false,
            });
            currentPosition.current = position_1;
            prevPosition.current = position_1;
        }
    }, [focus, previousFocus, viewBounds, currentPosition, prevPosition]);
    var position = state.position;
    // This part prevents an ugly jump from initial position to the focused one as the set state in the effects is after
    // initial render.
    if (focus && (previousFocus === null || previousFocus === void 0 ? void 0 : previousFocus.x) !== focus.x && (previousFocus === null || previousFocus === void 0 ? void 0 : previousFocus.y) !== focus.y) {
        position = focus;
    }
    return {
        state: __assign(__assign({}, state), { position: {
                x: inBounds(position.x, viewBounds.left, viewBounds.right),
                y: inBounds(position.y, viewBounds.top, viewBounds.bottom),
            } }),
        ref: panRef,
    };
}
function inBounds(value, min, max) {
    return Math.min(Math.max(value, min !== null && min !== void 0 ? min : -Infinity), max !== null && max !== void 0 ? max : Infinity);
}
function getEventXY(event) {
    if (event.changedTouches) {
        var e = event;
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    else {
        var e = event;
        return { x: e.clientX, y: e.clientY };
    }
}
//# sourceMappingURL=usePanning.js.map
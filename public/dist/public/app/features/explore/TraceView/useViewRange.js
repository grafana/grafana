import { __assign, __read } from "tslib";
import { useCallback, useState } from 'react';
/**
 * Controls state of the zoom function that can be used through minimap in header or on the timeline. ViewRange contains
 * state not only for current range that is showing but range that is currently being selected by the user.
 */
export function useViewRange() {
    var _a = __read(useState({
        time: {
            current: [0, 1],
        },
    }), 2), viewRange = _a[0], setViewRange = _a[1];
    var updateNextViewRangeTime = useCallback(function updateNextViewRangeTime(update) {
        setViewRange(function (prevRange) {
            var time = __assign(__assign({}, prevRange.time), update);
            return __assign(__assign({}, prevRange), { time: time });
        });
    }, []);
    var updateViewRangeTime = useCallback(function updateViewRangeTime(start, end) {
        var current = [start, end];
        var time = { current: current };
        setViewRange(function (prevRange) {
            return __assign(__assign({}, prevRange), { time: time });
        });
    }, []);
    return { viewRange: viewRange, updateViewRangeTime: updateViewRangeTime, updateNextViewRangeTime: updateNextViewRangeTime };
}
//# sourceMappingURL=useViewRange.js.map
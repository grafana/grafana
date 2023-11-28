import { useCallback, useState } from 'react';
/**
 * Controls state of the zoom function that can be used through minimap in header or on the timeline. ViewRange contains
 * state not only for current range that is showing but range that is currently being selected by the user.
 */
export function useViewRange() {
    const [viewRange, setViewRange] = useState({
        time: {
            current: [0, 1],
        },
    });
    const updateNextViewRangeTime = useCallback(function updateNextViewRangeTime(update) {
        setViewRange((prevRange) => {
            const time = Object.assign(Object.assign({}, prevRange.time), update);
            return Object.assign(Object.assign({}, prevRange), { time });
        });
    }, []);
    const updateViewRangeTime = useCallback(function updateViewRangeTime(start, end) {
        const current = [start, end];
        const time = { current };
        setViewRange((prevRange) => {
            return Object.assign(Object.assign({}, prevRange), { time });
        });
    }, []);
    return { viewRange, updateViewRangeTime, updateNextViewRangeTime };
}
//# sourceMappingURL=useViewRange.js.map
import { __read } from "tslib";
import { useEffect, useState } from 'react';
import useMountedState from 'react-use/lib/useMountedState';
export function useHighlight(focusedNodeId) {
    var _a = __read(useState(), 2), highlightId = _a[0], setHighlightId = _a[1];
    var mounted = useMountedState();
    useEffect(function () {
        if (focusedNodeId) {
            setHighlightId(focusedNodeId);
            setTimeout(function () {
                if (mounted()) {
                    setHighlightId(undefined);
                }
            }, 500);
        }
    }, [focusedNodeId, mounted]);
    return highlightId;
}
//# sourceMappingURL=useHighlight.js.map
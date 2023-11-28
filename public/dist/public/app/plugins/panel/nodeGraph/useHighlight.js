import { useEffect, useState } from 'react';
import useMountedState from 'react-use/lib/useMountedState';
export function useHighlight(focusedNodeId) {
    const [highlightId, setHighlightId] = useState();
    const mounted = useMountedState();
    useEffect(() => {
        if (focusedNodeId) {
            setHighlightId(focusedNodeId);
            setTimeout(() => {
                if (mounted()) {
                    setHighlightId(undefined);
                }
            }, 500);
        }
    }, [focusedNodeId, mounted]);
    return highlightId;
}
//# sourceMappingURL=useHighlight.js.map
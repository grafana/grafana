import { __read } from "tslib";
import { useCallback, useState } from 'react';
/**
 * Children state means whether spans are collapsed or not. Also provides some functions to manipulate that state.
 */
export function useChildrenState() {
    var _a = __read(useState(new Set()), 2), childrenHiddenIDs = _a[0], setChildrenHiddenIDs = _a[1];
    var expandOne = useCallback(function expandOne(spans) {
        if (childrenHiddenIDs.size === 0) {
            return;
        }
        var prevExpandedDepth = -1;
        var expandNextHiddenSpan = true;
        var newChildrenHiddenIDs = spans.reduce(function (res, s) {
            if (s.depth <= prevExpandedDepth) {
                expandNextHiddenSpan = true;
            }
            if (expandNextHiddenSpan && res.has(s.spanID)) {
                res.delete(s.spanID);
                expandNextHiddenSpan = false;
                prevExpandedDepth = s.depth;
            }
            return res;
        }, new Set(childrenHiddenIDs));
        setChildrenHiddenIDs(newChildrenHiddenIDs);
    }, [childrenHiddenIDs]);
    var collapseOne = useCallback(function collapseOne(spans) {
        if (shouldDisableCollapse(spans, childrenHiddenIDs)) {
            return;
        }
        var nearestCollapsedAncestor;
        var newChildrenHiddenIDs = spans.reduce(function (res, curSpan) {
            if (nearestCollapsedAncestor && curSpan.depth <= nearestCollapsedAncestor.depth) {
                res.add(nearestCollapsedAncestor.spanID);
                if (curSpan.hasChildren) {
                    nearestCollapsedAncestor = curSpan;
                }
            }
            else if (curSpan.hasChildren && !res.has(curSpan.spanID)) {
                nearestCollapsedAncestor = curSpan;
            }
            return res;
        }, new Set(childrenHiddenIDs));
        // The last one
        if (nearestCollapsedAncestor) {
            newChildrenHiddenIDs.add(nearestCollapsedAncestor.spanID);
        }
        setChildrenHiddenIDs(newChildrenHiddenIDs);
    }, [childrenHiddenIDs]);
    var expandAll = useCallback(function expandAll() {
        setChildrenHiddenIDs(new Set());
    }, []);
    var collapseAll = useCallback(function collapseAll(spans) {
        if (shouldDisableCollapse(spans, childrenHiddenIDs)) {
            return;
        }
        var newChildrenHiddenIDs = spans.reduce(function (res, s) {
            if (s.hasChildren) {
                res.add(s.spanID);
            }
            return res;
        }, new Set());
        setChildrenHiddenIDs(newChildrenHiddenIDs);
    }, [childrenHiddenIDs]);
    var childrenToggle = useCallback(function childrenToggle(spanID) {
        var newChildrenHiddenIDs = new Set(childrenHiddenIDs);
        if (childrenHiddenIDs.has(spanID)) {
            newChildrenHiddenIDs.delete(spanID);
        }
        else {
            newChildrenHiddenIDs.add(spanID);
        }
        setChildrenHiddenIDs(newChildrenHiddenIDs);
    }, [childrenHiddenIDs]);
    return {
        childrenHiddenIDs: childrenHiddenIDs,
        expandOne: expandOne,
        collapseOne: collapseOne,
        expandAll: expandAll,
        collapseAll: collapseAll,
        childrenToggle: childrenToggle,
    };
}
function shouldDisableCollapse(allSpans, hiddenSpansIds) {
    var allParentSpans = allSpans.filter(function (s) { return s.hasChildren; });
    return allParentSpans.length === hiddenSpansIds.size;
}
//# sourceMappingURL=useChildrenState.js.map
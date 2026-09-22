import { useCallback, useState } from 'react';

import { type TraceSpan } from './components/types/trace';
import spanAncestorIds from './components/utils/span-ancestor-ids';

/**
 * Children state means whether spans are collapsed or not. Also provides some functions to manipulate that state.
 */
export function useChildrenState() {
  const [childrenHiddenIDs, setChildrenHiddenIDs] = useState(new Set<string>());

  const expandOne = useCallback(
    function expandOne(spans: TraceSpan[]) {
      if (childrenHiddenIDs.size === 0) {
        return;
      }
      let prevExpandedDepth = -1;
      let expandNextHiddenSpan = true;
      const newChildrenHiddenIDs = spans.reduce((res, s) => {
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
    },
    [childrenHiddenIDs]
  );

  const collapseOne = useCallback(
    function collapseOne(spans: TraceSpan[]) {
      if (shouldDisableCollapse(spans, childrenHiddenIDs)) {
        return;
      }
      let nearestCollapsedAncestor: TraceSpan | undefined;
      const newChildrenHiddenIDs = spans.reduce((res, curSpan) => {
        if (nearestCollapsedAncestor && curSpan.depth <= nearestCollapsedAncestor.depth) {
          res.add(nearestCollapsedAncestor.spanID);
          if (curSpan.hasChildren) {
            nearestCollapsedAncestor = curSpan;
          }
        } else if (curSpan.hasChildren && !res.has(curSpan.spanID)) {
          nearestCollapsedAncestor = curSpan;
        }
        return res;
      }, new Set(childrenHiddenIDs));
      // The last one
      if (nearestCollapsedAncestor) {
        newChildrenHiddenIDs.add(nearestCollapsedAncestor.spanID);
      }
      setChildrenHiddenIDs(newChildrenHiddenIDs);
    },
    [childrenHiddenIDs]
  );

  const expandAll = useCallback(function expandAll() {
    setChildrenHiddenIDs(new Set<string>());
  }, []);

  const collapseAll = useCallback(
    function collapseAll(spans: TraceSpan[]) {
      if (shouldDisableCollapse(spans, childrenHiddenIDs)) {
        return;
      }
      const newChildrenHiddenIDs = spans.reduce((res, s) => {
        if (s.hasChildren) {
          res.add(s.spanID);
        }
        return res;
      }, new Set<string>());

      setChildrenHiddenIDs(newChildrenHiddenIDs);
    },
    [childrenHiddenIDs]
  );

  const childrenToggle = useCallback(
    function childrenToggle(spanID: string) {
      const newChildrenHiddenIDs = new Set(childrenHiddenIDs);
      if (childrenHiddenIDs.has(spanID)) {
        newChildrenHiddenIDs.delete(spanID);
      } else {
        newChildrenHiddenIDs.add(spanID);
      }
      setChildrenHiddenIDs(newChildrenHiddenIDs);
    },
    [childrenHiddenIDs]
  );

  const revealSpan = useCallback(
    function revealSpan(span: TraceSpan) {
      const ancestorIds = spanAncestorIds(span);
      if (!ancestorIds.some((id) => childrenHiddenIDs.has(id))) {
        return;
      }
      const next = new Set(childrenHiddenIDs);
      for (const id of ancestorIds) {
        next.delete(id);
      }
      setChildrenHiddenIDs(next);
    },
    [childrenHiddenIDs]
  );

  return {
    childrenHiddenIDs,
    expandOne,
    collapseOne,
    expandAll,
    collapseAll,
    childrenToggle,
    revealSpan,
  };
}

function shouldDisableCollapse(allSpans: TraceSpan[], hiddenSpansIds: Set<string>) {
  const allParentSpans = allSpans.filter((s) => s.hasChildren);
  return allParentSpans.length === hiddenSpansIds.size;
}

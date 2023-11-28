// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
/**
 * Returns `{ isHidden: true, ... }` if one of the parents of `span` is
 * collapsed, e.g. has children hidden.
 *
 * @param {TraceSpan} span The Span to check for.
 * @param {Set<string>} childrenAreHidden The set of Spans known to have hidden
 *                                        children, either because it is
 *                                        collapsed or has a collapsed parent.
 * @param {Map<string, TraceSpan | TNil} spansMap Mapping from spanID to Span.
 * @returns {{ isHidden: boolean, parentIds: Set<string> }}
 */
function isSpanHidden(span, childrenAreHidden, spansMap) {
    const parentIDs = new Set();
    let { references } = span;
    let parentID;
    const checkRef = (ref) => {
        if (ref.refType === 'CHILD_OF' || ref.refType === 'FOLLOWS_FROM') {
            parentID = ref.spanID;
            parentIDs.add(parentID);
            return childrenAreHidden.has(parentID);
        }
        return false;
    };
    while (Array.isArray(references) && references.length) {
        const isHidden = references.some(checkRef);
        if (isHidden) {
            return { isHidden, parentIDs };
        }
        if (!parentID) {
            break;
        }
        const parent = spansMap.get(parentID);
        parentID = undefined;
        references = parent && parent.references;
    }
    return { parentIDs, isHidden: false };
}
/**
 * ScrollManager is intended for scrolling the TracePage. Has two modes, paging
 * and scrolling to the previous or next visible span.
 */
export default class ScrollManager {
    constructor(trace, scroller) {
        /**
         * `setAccessors` is bound in the ctor, so it can be passed as a prop to
         * children components.
         */
        this.setAccessors = (accessors) => {
            this._accessors = accessors;
        };
        /**
         * Scrolls around one page down (0.95x). It is bounds in the ctor, so it can
         * be used as a keyboard shortcut handler.
         */
        this.scrollPageDown = () => {
            if (!this._scroller || !this._accessors) {
                return;
            }
            this._scroller.scrollBy(0.95 * this._accessors.getViewHeight(), true);
        };
        /**
         * Scrolls around one page up (0.95x). It is bounds in the ctor, so it can
         * be used as a keyboard shortcut handler.
         */
        this.scrollPageUp = () => {
            if (!this._scroller || !this._accessors) {
                return;
            }
            this._scroller.scrollBy(-0.95 * this._accessors.getViewHeight(), true);
        };
        /**
         * Scrolls to the next visible span, ignoring spans that do not match the
         * text filter, if there is one. It is bounds in the ctor, so it can
         * be used as a keyboard shortcut handler.
         */
        this.scrollToNextVisibleSpan = () => {
            this._scrollToVisibleSpan(1);
        };
        /**
         * Scrolls to the previous visible span, ignoring spans that do not match the
         * text filter, if there is one. It is bounds in the ctor, so it can
         * be used as a keyboard shortcut handler.
         */
        this.scrollToPrevVisibleSpan = () => {
            this._scrollToVisibleSpan(-1);
        };
        this.scrollToFirstVisibleSpan = () => {
            this._scrollToVisibleSpan(1, 0);
        };
        this._trace = trace;
        this._scroller = scroller;
        this._accessors = undefined;
    }
    _scrollPast(rowIndex, direction) {
        var _a;
        const xrs = this._accessors;
        /* istanbul ignore next */
        if (!xrs) {
            throw new Error('Accessors not set');
        }
        const isUp = direction < 0;
        const position = xrs.getRowPosition(rowIndex);
        if (!position) {
            // eslint-disable-next-line no-console
            console.warn('Invalid row index');
            return;
        }
        let { y } = position;
        const vh = xrs.getViewHeight();
        if (!isUp) {
            y += position.height;
            // scrollTop is based on the top of the window
            y -= vh;
        }
        y += direction * 0.5 * vh;
        (_a = this._scroller) === null || _a === void 0 ? void 0 : _a.scrollTo(y);
    }
    _scrollToVisibleSpan(direction, startRow) {
        const xrs = this._accessors;
        /* istanbul ignore next */
        if (!xrs) {
            throw new Error('Accessors not set');
        }
        if (!this._trace) {
            return;
        }
        const { duration, spans, startTime: traceStartTime } = this._trace;
        const isUp = direction < 0;
        let boundaryRow;
        if (startRow != null) {
            boundaryRow = startRow;
        }
        else if (isUp) {
            boundaryRow = xrs.getTopRowIndexVisible();
        }
        else {
            boundaryRow = xrs.getBottomRowIndexVisible();
        }
        const spanIndex = xrs.mapRowIndexToSpanIndex(boundaryRow);
        if ((spanIndex === 0 && isUp) || (spanIndex === spans.length - 1 && !isUp)) {
            return;
        }
        // fullViewSpanIndex is one row inside the view window unless already at the top or bottom
        let fullViewSpanIndex = spanIndex;
        if (spanIndex !== 0 && spanIndex !== spans.length - 1) {
            fullViewSpanIndex -= direction;
        }
        const [viewStart, viewEnd] = xrs.getViewRange();
        const checkVisibility = viewStart !== 0 || viewEnd !== 1;
        // use NaN as fallback to make flow happy
        const startTime = checkVisibility ? traceStartTime + duration * viewStart : NaN;
        const endTime = checkVisibility ? traceStartTime + duration * viewEnd : NaN;
        const findMatches = xrs.getSearchedSpanIDs();
        const _collapsed = xrs.getCollapsedChildren();
        const childrenAreHidden = _collapsed ? new Set(_collapsed) : null;
        // use empty Map as fallback to make flow happy
        const spansMap = childrenAreHidden ? new Map(spans.map((s) => [s.spanID, s])) : new Map();
        const boundary = direction < 0 ? -1 : spans.length;
        let nextSpanIndex;
        for (let i = fullViewSpanIndex + direction; i !== boundary; i += direction) {
            const span = spans[i];
            const { duration: spanDuration, spanID, startTime: spanStartTime } = span;
            const spanEndTime = spanStartTime + spanDuration;
            if (checkVisibility && (spanStartTime > endTime || spanEndTime < startTime)) {
                // span is not visible within the view range
                continue;
            }
            if (findMatches && !findMatches.has(spanID)) {
                // skip to search matches (when searching)
                continue;
            }
            if (childrenAreHidden) {
                // make sure the span is not collapsed
                const { isHidden, parentIDs } = isSpanHidden(span, childrenAreHidden, spansMap);
                if (isHidden) {
                    parentIDs.forEach((id) => childrenAreHidden.add(id));
                    continue;
                }
            }
            nextSpanIndex = i;
            break;
        }
        if (!nextSpanIndex || nextSpanIndex === boundary) {
            // might as well scroll to the top or bottom
            nextSpanIndex = boundary - direction;
            // If there are hidden children, scroll to the last visible span
            if (childrenAreHidden) {
                let isFallbackHidden;
                do {
                    const { isHidden, parentIDs } = isSpanHidden(spans[nextSpanIndex], childrenAreHidden, spansMap);
                    if (isHidden) {
                        parentIDs.forEach((id) => childrenAreHidden.add(id));
                        nextSpanIndex--;
                    }
                    isFallbackHidden = isHidden;
                } while (isFallbackHidden);
            }
        }
        const nextRow = xrs.mapSpanIndexToRowIndex(nextSpanIndex);
        this._scrollPast(nextRow, direction);
    }
    /**
     * Sometimes the ScrollManager is created before the trace is loaded. This
     * setter allows the trace to be set asynchronously.
     */
    setTrace(trace) {
        this._trace = trace;
    }
    destroy() {
        this._trace = undefined;
        this._scroller = undefined;
        this._accessors = undefined;
    }
}
//# sourceMappingURL=ScrollManager.js.map
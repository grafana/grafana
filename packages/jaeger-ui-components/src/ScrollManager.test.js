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

/* eslint-disable import/first */
jest.mock('./scroll-page');

import { scrollBy, scrollTo } from './scroll-page';
import ScrollManager from './ScrollManager';

const SPAN_HEIGHT = 2;

function getTrace() {
  const spans = [];
  const trace = {
    spans,
    duration: 2000,
    startTime: 1000,
  };
  for (let i = 0; i < 10; i++) {
    spans.push({ duration: 1, startTime: 1000, spanID: i + 1 });
  }
  return trace;
}

function getAccessors() {
  return {
    getViewRange: jest.fn(() => [0, 1]),
    getSearchedSpanIDs: jest.fn(),
    getCollapsedChildren: jest.fn(),
    getViewHeight: jest.fn(() => SPAN_HEIGHT * 2),
    getBottomRowIndexVisible: jest.fn(),
    getTopRowIndexVisible: jest.fn(),
    getRowPosition: jest.fn(),
    mapRowIndexToSpanIndex: jest.fn(n => n),
    mapSpanIndexToRowIndex: jest.fn(n => n),
  };
}

describe('ScrollManager', () => {
  let trace;
  let accessors;
  let manager;

  beforeEach(() => {
    scrollBy.mockReset();
    scrollTo.mockReset();
    trace = getTrace();
    accessors = getAccessors();
    manager = new ScrollManager(trace, { scrollBy, scrollTo });
    manager.setAccessors(accessors);
  });

  it('saves the accessors', () => {
    const n = Math.random();
    manager.setAccessors(n);
    expect(manager._accessors).toBe(n);
  });

  describe('_scrollPast()', () => {
    it('throws if accessors is not set', () => {
      manager.setAccessors(null);
      expect(manager._scrollPast).toThrow();
    });

    it('is a noop if an invalid rowPosition is returned by the accessors', () => {
      // eslint-disable-next-line no-console
      const oldWarn = console.warn;
      // eslint-disable-next-line no-console
      console.warn = () => {};
      manager._scrollPast(null, null);
      expect(accessors.getRowPosition.mock.calls.length).toBe(1);
      expect(accessors.getViewHeight.mock.calls.length).toBe(0);
      expect(scrollTo.mock.calls.length).toBe(0);
      // eslint-disable-next-line no-console
      console.warn = oldWarn;
    });

    it('scrolls up with direction is `-1`', () => {
      const y = 10;
      const expectTo = y - 0.5 * accessors.getViewHeight();
      accessors.getRowPosition.mockReturnValue({ y, height: SPAN_HEIGHT });
      manager._scrollPast(NaN, -1);
      expect(scrollTo.mock.calls).toEqual([[expectTo]]);
    });

    it('scrolls down with direction `1`', () => {
      const y = 10;
      const vh = accessors.getViewHeight();
      const expectTo = y + SPAN_HEIGHT - 0.5 * vh;
      accessors.getRowPosition.mockReturnValue({ y, height: SPAN_HEIGHT });
      manager._scrollPast(NaN, 1);
      expect(scrollTo.mock.calls).toEqual([[expectTo]]);
    });
  });

  describe('_scrollToVisibleSpan()', () => {
    function getRefs(spanID) {
      return [{ refType: 'CHILD_OF', spanID }];
    }
    let scrollPastMock;

    beforeEach(() => {
      scrollPastMock = jest.fn();
      manager._scrollPast = scrollPastMock;
    });
    it('throws if accessors is not set', () => {
      manager.setAccessors(null);
      expect(manager._scrollToVisibleSpan).toThrow();
    });
    it('exits if the trace is not set', () => {
      manager.setTrace(null);
      manager._scrollToVisibleSpan();
      expect(scrollPastMock.mock.calls.length).toBe(0);
    });

    it('does nothing if already at the boundary', () => {
      accessors.getTopRowIndexVisible.mockReturnValue(0);
      accessors.getBottomRowIndexVisible.mockReturnValue(trace.spans.length - 1);
      manager._scrollToVisibleSpan(-1);
      expect(scrollPastMock.mock.calls.length).toBe(0);
      manager._scrollToVisibleSpan(1);
      expect(scrollPastMock.mock.calls.length).toBe(0);
    });

    it('centers the current top or bottom span', () => {
      accessors.getTopRowIndexVisible.mockReturnValue(5);
      accessors.getBottomRowIndexVisible.mockReturnValue(5);
      manager._scrollToVisibleSpan(-1);
      expect(scrollPastMock).lastCalledWith(5, -1);
      manager._scrollToVisibleSpan(1);
      expect(scrollPastMock).lastCalledWith(5, 1);
    });

    it('skips spans that are out of view', () => {
      trace.spans[4].startTime = trace.startTime + trace.duration * 0.5;
      accessors.getViewRange = () => [0.4, 0.6];
      accessors.getTopRowIndexVisible.mockReturnValue(trace.spans.length - 1);
      accessors.getBottomRowIndexVisible.mockReturnValue(0);
      manager._scrollToVisibleSpan(1);
      expect(scrollPastMock).lastCalledWith(4, 1);
      manager._scrollToVisibleSpan(-1);
      expect(scrollPastMock).lastCalledWith(4, -1);
    });

    it('skips spans that do not match the text search', () => {
      accessors.getTopRowIndexVisible.mockReturnValue(trace.spans.length - 1);
      accessors.getBottomRowIndexVisible.mockReturnValue(0);
      accessors.getSearchedSpanIDs = () => new Set([trace.spans[4].spanID]);
      manager._scrollToVisibleSpan(1);
      expect(scrollPastMock).lastCalledWith(4, 1);
      manager._scrollToVisibleSpan(-1);
      expect(scrollPastMock).lastCalledWith(4, -1);
    });

    it('scrolls to boundary when scrolling away from closest spanID in findMatches', () => {
      const closetFindMatchesSpanID = 4;
      accessors.getTopRowIndexVisible.mockReturnValue(closetFindMatchesSpanID - 1);
      accessors.getBottomRowIndexVisible.mockReturnValue(closetFindMatchesSpanID + 1);
      accessors.getSearchedSpanIDs = () => new Set([trace.spans[closetFindMatchesSpanID].spanID]);

      manager._scrollToVisibleSpan(1);
      expect(scrollPastMock).lastCalledWith(trace.spans.length - 1, 1);

      manager._scrollToVisibleSpan(-1);
      expect(scrollPastMock).lastCalledWith(0, -1);
    });

    it('scrolls to last visible row when boundary is hidden', () => {
      const parentOfLastRowWithHiddenChildrenIndex = trace.spans.length - 2;
      accessors.getBottomRowIndexVisible.mockReturnValue(0);
      accessors.getCollapsedChildren = () =>
        new Set([trace.spans[parentOfLastRowWithHiddenChildrenIndex].spanID]);
      accessors.getSearchedSpanIDs = () => new Set([trace.spans[0].spanID]);
      trace.spans[trace.spans.length - 1].references = getRefs(
        trace.spans[parentOfLastRowWithHiddenChildrenIndex].spanID
      );

      manager._scrollToVisibleSpan(1);
      expect(scrollPastMock).lastCalledWith(parentOfLastRowWithHiddenChildrenIndex, 1);
    });

    describe('scrollToNextVisibleSpan() and scrollToPrevVisibleSpan()', () => {
      beforeEach(() => {
        // change spans so 0 and 4 are top-level and their children are collapsed
        const spans = trace.spans;
        let parentID;
        for (let i = 0; i < spans.length; i++) {
          switch (i) {
            case 0:
            case 4:
              parentID = spans[i].spanID;
              break;
            default:
              spans[i].references = getRefs(parentID);
          }
        }
        // set which spans are "in-view" and which have collapsed children
        accessors.getTopRowIndexVisible.mockReturnValue(trace.spans.length - 1);
        accessors.getBottomRowIndexVisible.mockReturnValue(0);
        accessors.getCollapsedChildren.mockReturnValue(new Set([spans[0].spanID, spans[4].spanID]));
      });

      it('skips spans that are hidden because their parent is collapsed', () => {
        manager.scrollToNextVisibleSpan();
        expect(scrollPastMock).lastCalledWith(4, 1);
        manager.scrollToPrevVisibleSpan();
        expect(scrollPastMock).lastCalledWith(4, -1);
      });

      it('ignores references with unknown types', () => {
        // modify spans[2] so that it has an unknown refType
        const spans = trace.spans;
        spans[2].references = [{ refType: 'OTHER' }];
        manager.scrollToNextVisibleSpan();
        expect(scrollPastMock).lastCalledWith(2, 1);
        manager.scrollToPrevVisibleSpan();
        expect(scrollPastMock).lastCalledWith(4, -1);
      });

      it('handles more than one level of ancestry', () => {
        // modify spans[2] so that it has an unknown refType
        const spans = trace.spans;
        spans[2].references = getRefs(spans[1].spanID);
        manager.scrollToNextVisibleSpan();
        expect(scrollPastMock).lastCalledWith(4, 1);
        manager.scrollToPrevVisibleSpan();
        expect(scrollPastMock).lastCalledWith(4, -1);
      });
    });

    describe('scrollToFirstVisibleSpan', () => {
      beforeEach(() => {
        jest.spyOn(manager, '_scrollToVisibleSpan').mockImplementationOnce();
      });

      it('calls _scrollToVisibleSpan searching downwards from first span', () => {
        manager.scrollToFirstVisibleSpan();
        expect(manager._scrollToVisibleSpan).toHaveBeenCalledWith(1, 0);
      });
    });
  });

  describe('scrollPageDown() and scrollPageUp()', () => {
    it('scrolls by +/~ viewHeight when invoked', () => {
      manager.scrollPageDown();
      expect(scrollBy).lastCalledWith(0.95 * accessors.getViewHeight(), true);
      manager.scrollPageUp();
      expect(scrollBy).lastCalledWith(-0.95 * accessors.getViewHeight(), true);
    });

    it('is a no-op if _accessors or _scroller is not defined', () => {
      manager._accessors = null;
      manager.scrollPageDown();
      manager.scrollPageUp();
      expect(scrollBy.mock.calls.length).toBe(0);
      manager._accessors = accessors;
      manager._scroller = null;
      manager.scrollPageDown();
      manager.scrollPageUp();
      expect(scrollBy.mock.calls.length).toBe(0);
    });
  });

  describe('destroy()', () => {
    it('disposes', () => {
      expect(manager._trace).toBeDefined();
      expect(manager._accessors).toBeDefined();
      expect(manager._scroller).toBeDefined();
      manager.destroy();
      expect(manager._trace).not.toBeDefined();
      expect(manager._accessors).not.toBeDefined();
      expect(manager._scroller).not.toBeDefined();
    });
  });
});

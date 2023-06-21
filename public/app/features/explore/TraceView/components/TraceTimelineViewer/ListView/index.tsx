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

import * as React from 'react';

import { TNil } from '../../types';

import Positions from './Positions';

type TWrapperProps = {
  style: React.CSSProperties;
  ref: (elm: HTMLDivElement) => void;
  onScroll?: () => void;
};

/**
 * @typedef
 */
export type TListViewProps = {
  /**
   * Number of elements in the list.
   */
  dataLength: number;
  /**
   * Convert item index (number) to the key (string). ListView uses both indexes
   * and keys to handle the addition of new rows.
   */
  getIndexFromKey: (key: string) => number;
  /**
   * Convert item key (string) to the index (number). ListView uses both indexes
   * and keys to handle the addition of new rows.
   */
  getKeyFromIndex: (index: number) => string;
  /**
   * Number of items to draw and add to the DOM, initially.
   */
  initialDraw?: number;
  /**
   * The parent provides fallback height measurements when there is not a
   * rendered element to measure.
   */
  itemHeightGetter: (index: number, key: string) => number;
  /**
   * Function that renders an item; rendered items are added directly to the
   * DOM, they are not wrapped in list item wrapper HTMLElement.
   */
  // itemRenderer(itemKey, style, i, attrs)
  itemRenderer: (
    itemKey: string,
    style: Record<string, string | number>,
    index: number,
    attributes: Record<string, string>
  ) => React.ReactNode;
  /**
   * `className` for the HTMLElement that holds the items.
   */
  itemsWrapperClassName?: string;
  /**
   * When adding new items to the DOM, this is the number of items to add above
   * and below the current view. E.g. if list is 100 items and is scrolled
   * halfway down (so items [46, 55] are in view), then when a new range of
   * items is rendered, it will render items `46 - viewBuffer` to
   * `55 + viewBuffer`.
   */
  viewBuffer: number;
  /**
   * The minimum number of items offscreen in either direction; e.g. at least
   * `viewBuffer` number of items must be off screen above and below the
   * current view, or more items will be rendered.
   */
  viewBufferMin: number;
  /**
   * When `true`, expect `_wrapperElm` to have `overflow: visible` and to,
   * essentially, be tall to the point the entire page will will end up
   * scrolling as a result of the ListView. Similar to react-virtualized
   * window scroller.
   *
   * - Ref: https://bvaughn.github.io/react-virtualized/#/components/WindowScroller
   * - Ref:https://github.com/bvaughn/react-virtualized/blob/497e2a1942529560681d65a9ef9f5e9c9c9a49ba/docs/WindowScroller.md
   */
  windowScroller?: boolean;
  /**
   * You need to pass in scrollElement when windowScroller is set to false.
   * This element is responsible for tracking scrolling for lazy loading.
   */
  scrollElement?: Element;
};

const DEFAULT_INITIAL_DRAW = 100;

/**
 * Virtualized list view component, for the most part, only renders the window
 * of items that are in-view with some buffer before and after. Listens for
 * scroll events and updates which items are rendered. See react-virtualized
 * for a suite of components with similar, but generalized, functionality.
 * https://github.com/bvaughn/react-virtualized
 *
 * Note: Presently, ListView cannot be a PureComponent. This is because ListView
 * is sensitive to the underlying state that drives the list items, but it
 * doesn't actually receive that state. So, a render may still be required even
 * if ListView's props are unchanged.
 *
 * @export
 * @class ListView
 */
export default class ListView extends React.Component<TListViewProps> {
  /**
   * Keeps track of the height and y-value of items, by item index, in the
   * ListView.
   */
  _yPositions: Positions;
  /**
   * Keep track of the known / measured heights of the rendered items; populated
   * with values through observation and keyed on the item key, not the item
   * index.
   */
  _knownHeights: Map<string, number>;
  /**
   * The start index of the items currently drawn.
   */
  _startIndexDrawn: number;
  /**
   * The end index of the items currently drawn.
   */
  _endIndexDrawn: number;
  /**
   * The start index of the items currently in view.
   */
  _startIndex: number;
  /**
   * The end index of the items currently in view.
   */
  _endIndex: number;
  /**
   * Height of the visual window, e.g. height of the scroller element.
   */
  _viewHeight: number;
  /**
   * `scrollTop` of the current scroll position.
   */
  _scrollTop: number;
  /**
   * Used to keep track of whether or not a re-calculation of what should be
   * drawn / viewable has been scheduled.
   */
  _isScrolledOrResized: boolean;
  /**
   * If `windowScroller` is true, this notes how far down the page the scroller
   * is located. (Note: repositioning and below-the-fold views are untested)
   */
  _htmlTopOffset: number;
  _windowScrollListenerAdded: boolean;
  _htmlElm: HTMLElement;
  /**
   * Element holding the scroller.
   */
  _wrapperElm: Element | TNil;
  /**
   * HTMLElement holding the rendered items.
   */
  _itemHolderElm: HTMLElement | TNil;

  static defaultProps = {
    initialDraw: DEFAULT_INITIAL_DRAW,
    itemsWrapperClassName: '',
    windowScroller: false,
  };

  constructor(props: TListViewProps) {
    super(props);

    this._yPositions = new Positions(200);
    // _knownHeights is (item-key -> observed height) of list items
    this._knownHeights = new Map();

    this._startIndexDrawn = 2 ** 20;
    this._endIndexDrawn = -(2 ** 20);
    this._startIndex = 0;
    this._endIndex = 0;
    this._viewHeight = -1;
    this._scrollTop = -1;
    this._isScrolledOrResized = false;

    this._htmlTopOffset = -1;
    this._windowScrollListenerAdded = false;
    // _htmlElm is only relevant if props.windowScroller is true
    this._htmlElm = document.documentElement;
    this._wrapperElm = undefined;
    this._itemHolderElm = undefined;
  }

  componentDidMount() {
    if (this.props.windowScroller) {
      if (this._wrapperElm) {
        const { top } = this._wrapperElm.getBoundingClientRect();
        this._htmlTopOffset = top + this._htmlElm.scrollTop;
      }
      window.addEventListener('scroll', this._onScroll);
      this._windowScrollListenerAdded = true;
    } else {
      // The wrapper element should be the one that handles the scrolling. Once we are not using scroll-canvas we can remove this.
      this._wrapperElm = this.props.scrollElement;
      this._wrapperElm?.addEventListener('scroll', this._onScroll);
    }
  }

  componentDidUpdate(prevProps: TListViewProps) {
    if (this._itemHolderElm) {
      this._scanItemHeights();
    }
    // When windowScroller is set to false, we can continue to handle scrollElement
    if (this.props.windowScroller) {
      return;
    }
    // check if the scrollElement changes and update its scroll listener
    if (prevProps.scrollElement !== this.props.scrollElement) {
      prevProps.scrollElement?.removeEventListener('scroll', this._onScroll);
      this._wrapperElm = this.props.scrollElement;
      this._wrapperElm?.addEventListener('scroll', this._onScroll);
    }
  }

  componentWillUnmount() {
    if (this._windowScrollListenerAdded) {
      window.removeEventListener('scroll', this._onScroll);
    } else {
      this._wrapperElm?.removeEventListener('scroll', this._onScroll);
    }
  }

  getViewHeight = () => this._viewHeight;

  /**
   * Get the index of the item at the bottom of the current view.
   */
  getBottomVisibleIndex = (): number => {
    const bottomY = this._scrollTop + this._viewHeight;
    return this._yPositions.findFloorIndex(bottomY, this._getHeight);
  };

  /**
   * Get the index of the item at the top of the current view.
   */
  getTopVisibleIndex = (): number => this._yPositions.findFloorIndex(this._scrollTop, this._getHeight);

  getRowPosition = (index: number): { height: number; y: number } =>
    this._yPositions.getRowPosition(index, this._getHeight);

  scrollToIndex = (index: number, headerHeight: number) => {
    // calculate the position of the list view relative to the scroll parent
    const { scrollElement } = this.props;
    const scrollElementTop = scrollElement?.getBoundingClientRect().top || 0;
    const listViewTop = (scrollElement?.scrollTop || 0) + (this._itemHolderElm?.getBoundingClientRect().top || 0);
    const listViewOffset = listViewTop - scrollElementTop;

    const itemOffset = this.getRowPosition(index).y;

    // hard code a small offset to leave a little bit of space above the focused span, so it is visually clear
    // that there is content above
    this.props.scrollElement?.scrollTo({ top: itemOffset + listViewOffset - headerHeight - 80 });
  };

  /**
   * Scroll event listener that schedules a remeasuring of which items should be
   * rendered.
   */
  _onScroll = () => {
    if (!this._isScrolledOrResized) {
      this._isScrolledOrResized = true;
      window.requestAnimationFrame(this._positionList);
    }
  };

  /**
   * Returns true is the view height (scroll window) or scroll position have
   * changed.
   */
  _isViewChanged() {
    if (!this._wrapperElm) {
      return false;
    }
    const useRoot = this.props.windowScroller;
    const clientHeight = useRoot ? this._htmlElm.clientHeight : this._wrapperElm.clientHeight;
    const scrollTop = useRoot ? this._htmlElm.scrollTop : this._wrapperElm.scrollTop;
    return clientHeight !== this._viewHeight || scrollTop !== this._scrollTop;
  }

  /**
   * Recalculate _startIndex and _endIndex, e.g. which items are in view.
   */
  _calcViewIndexes() {
    const useRoot = this.props.windowScroller;
    // funky if statement is to satisfy flow
    if (!useRoot) {
      /* istanbul ignore next */
      if (!this._wrapperElm) {
        this._viewHeight = -1;
        this._startIndex = 0;
        this._endIndex = 0;
        return;
      }
      this._viewHeight = this._wrapperElm.clientHeight;
      this._scrollTop = this._wrapperElm.scrollTop;
    } else {
      this._viewHeight = window.innerHeight - this._htmlTopOffset;
      this._scrollTop = window.scrollY;
    }
    const yStart = this._scrollTop;
    const yEnd = this._scrollTop + this._viewHeight;
    this._startIndex = this._yPositions.findFloorIndex(yStart, this._getHeight);
    this._endIndex = this._yPositions.findFloorIndex(yEnd, this._getHeight);
  }

  /**
   * Checked to see if the currently rendered items are sufficient, if not,
   * force an update to trigger more items to be rendered.
   */
  _positionList = () => {
    this._isScrolledOrResized = false;
    if (!this._wrapperElm) {
      return;
    }
    this._calcViewIndexes();
    // indexes drawn should be padded by at least props.viewBufferMin
    const maxStart = this.props.viewBufferMin > this._startIndex ? 0 : this._startIndex - this.props.viewBufferMin;
    const minEnd =
      this.props.viewBufferMin < this.props.dataLength - this._endIndex
        ? this._endIndex + this.props.viewBufferMin
        : this.props.dataLength - 1;
    if (maxStart < this._startIndexDrawn || minEnd > this._endIndexDrawn) {
      this.forceUpdate();
    }
  };

  _initWrapper = (elm: HTMLElement | TNil) => {
    if (!this.props.windowScroller) {
      return;
    }
    this._wrapperElm = elm;
    if (elm) {
      this._viewHeight = elm.clientHeight;
    }
  };

  _initItemHolder = (elm: HTMLElement | TNil) => {
    this._itemHolderElm = elm;
    this._scanItemHeights();
  };

  /**
   * Go through all items that are rendered and save their height based on their
   * item-key (which is on a data-* attribute). If any new or adjusted heights
   * are found, re-measure the current known y-positions (via .yPositions).
   */
  _scanItemHeights = () => {
    const getIndexFromKey = this.props.getIndexFromKey;
    if (!this._itemHolderElm) {
      return;
    }
    // note the keys for the first and last altered heights, the `yPositions`
    // needs to be updated
    let lowDirtyKey = null;
    let highDirtyKey = null;
    let isDirty = false;
    // iterating childNodes is faster than children
    // https://jsperf.com/large-htmlcollection-vs-large-nodelist
    const nodes = this._itemHolderElm.childNodes;
    const max = nodes.length;
    for (let i = 0; i < max; i++) {
      const node = nodes[i] as HTMLElement;
      // use `.getAttribute(...)` instead of `.dataset` for jest / JSDOM
      const itemKey = node.getAttribute('data-item-key');
      if (!itemKey) {
        // eslint-disable-next-line no-console
        console.warn('itemKey not found');
        continue;
      }
      // measure the first child, if it's available, otherwise the node itself
      // (likely not transferable to other contexts, and instead is specific to
      // how we have the items rendered)
      const measureSrc: Element = node.firstElementChild || node;
      const observed = measureSrc.clientHeight;
      const known = this._knownHeights.get(itemKey);
      if (observed !== known) {
        this._knownHeights.set(itemKey, observed);
        if (!isDirty) {
          isDirty = true;
          // eslint-disable-next-line no-multi-assign
          lowDirtyKey = highDirtyKey = itemKey;
        } else {
          highDirtyKey = itemKey;
        }
      }
    }
    if (lowDirtyKey != null && highDirtyKey != null) {
      // update yPositions, then redraw
      const imin = getIndexFromKey(lowDirtyKey);
      const imax = highDirtyKey === lowDirtyKey ? imin : getIndexFromKey(highDirtyKey);
      this._yPositions.calcHeights(imax, this._getHeight, imin);
      this.forceUpdate();
    }
  };

  /**
   * Get the height of the element at index `i`; first check the known heights,
   * fallback to `.props.itemHeightGetter(...)`.
   */
  _getHeight = (i: number) => {
    const key = this.props.getKeyFromIndex(i);
    const known = this._knownHeights.get(key);
    // known !== known iff known is NaN
    // eslint-disable-next-line no-self-compare
    if (known != null && known === known) {
      return known;
    }
    return this.props.itemHeightGetter(i, key);
  };

  render() {
    const {
      dataLength,
      getKeyFromIndex,
      initialDraw = DEFAULT_INITIAL_DRAW,
      itemRenderer,
      viewBuffer,
      viewBufferMin,
    } = this.props;
    const heightGetter = this._getHeight;
    const items = [];
    let start;
    let end;

    this._yPositions.profileData(dataLength);

    if (!this._wrapperElm) {
      start = 0;
      end = (initialDraw < dataLength ? initialDraw : dataLength) - 1;
    } else {
      if (this._isViewChanged()) {
        this._calcViewIndexes();
      }
      const maxStart = viewBufferMin > this._startIndex ? 0 : this._startIndex - viewBufferMin;
      const minEnd = viewBufferMin < dataLength - this._endIndex ? this._endIndex + viewBufferMin : dataLength - 1;
      if (maxStart < this._startIndexDrawn || minEnd > this._endIndexDrawn) {
        start = viewBuffer > this._startIndex ? 0 : this._startIndex - viewBuffer;
        end = this._endIndex + viewBuffer;
        if (end >= dataLength) {
          end = dataLength - 1;
        }
      } else {
        start = this._startIndexDrawn > dataLength - 1 ? 0 : this._startIndexDrawn;
        end = this._endIndexDrawn > dataLength - 1 ? dataLength - 1 : this._endIndexDrawn;
      }
    }

    this._yPositions.calcHeights(end, heightGetter, start || -1);
    this._startIndexDrawn = start;
    this._endIndexDrawn = end;

    items.length = end - start + 1;
    for (let i = start; i <= end; i++) {
      const { y: top, height } = this._yPositions.getRowPosition(i, heightGetter);
      const style = {
        height,
        top,
        position: 'absolute',
      };
      const itemKey = getKeyFromIndex(i);
      const attrs = { 'data-item-key': itemKey };
      items.push(itemRenderer(itemKey, style, i, attrs));
    }
    const wrapperProps: TWrapperProps = {
      style: { position: 'relative' },
      ref: this._initWrapper,
    };
    if (!this.props.windowScroller) {
      wrapperProps.onScroll = this._onScroll;
      wrapperProps.style.height = '100%';
      wrapperProps.style.overflowY = 'auto';
    }
    const scrollerStyle = {
      position: 'relative' as const,
      height: this._yPositions.getEstimatedHeight(),
    };
    return (
      <div {...wrapperProps} data-testid="ListView">
        <div style={scrollerStyle}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              margin: 0,
              padding: 0,
            }}
            className={this.props.itemsWrapperClassName}
            ref={this._initItemHolder}
          >
            {items}
          </div>
        </div>
      </div>
    );
  }
}

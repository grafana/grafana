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
import { css, cx } from 'emotion';

import { TUpdateViewRangeTimeFunction, ViewRangeTime, ViewRangeTimeUpdate } from '../types';
import { TNil } from '../../types';
import DraggableManager, { DraggableBounds, DraggingUpdate } from '../../utils/DraggableManager';
import { createStyle } from '../../Theme';

// exported for testing
export const getStyles = createStyle(() => {
  return {
    TimelineViewingLayer: css`
      label: TimelineViewingLayer;
      bottom: 0;
      cursor: vertical-text;
      left: 0;
      position: absolute;
      right: 0;
      top: 0;
    `,
    TimelineViewingLayerCursorGuide: css`
      label: TimelineViewingLayerCursorGuide;
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 1px;
      background-color: red;
    `,
    TimelineViewingLayerDragged: css`
      label: TimelineViewingLayerDragged;
      position: absolute;
      top: 0;
      bottom: 0;
    `,
    TimelineViewingLayerDraggedDraggingLeft: css`
      label: TimelineViewingLayerDraggedDraggingLeft;
      border-left: 1px solid;
    `,
    TimelineViewingLayerDraggedDraggingRight: css`
      label: TimelineViewingLayerDraggedDraggingRight;
      border-right: 1px solid;
    `,
    TimelineViewingLayerDraggedShiftDrag: css`
      label: TimelineViewingLayerDraggedShiftDrag;
      background-color: rgba(68, 68, 255, 0.2);
      border-color: #44f;
    `,
    TimelineViewingLayerDraggedReframeDrag: css`
      label: TimelineViewingLayerDraggedReframeDrag;
      background-color: rgba(255, 68, 68, 0.2);
      border-color: #f44;
    `,
    TimelineViewingLayerFullOverlay: css`
      label: TimelineViewingLayerFullOverlay;
      bottom: 0;
      cursor: col-resize;
      left: 0;
      position: fixed;
      right: 0;
      top: 0;
      user-select: none;
    `,
  };
});

type TimelineViewingLayerProps = {
  /**
   * `boundsInvalidator` is an arbitrary prop that lets the component know the
   * bounds for dragging need to be recalculated. In practice, the name column
   * width serves fine for this.
   */
  boundsInvalidator: any | null | undefined;
  updateNextViewRangeTime: (update: ViewRangeTimeUpdate) => void;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
  viewRangeTime: ViewRangeTime;
};

type TDraggingLeftLayout = {
  isDraggingLeft: boolean;
  left: string;
  width: string;
};

type TOutOfViewLayout = {
  isOutOfView: true;
};

function isOutOfView(layout: TDraggingLeftLayout | TOutOfViewLayout): layout is TOutOfViewLayout {
  return Reflect.has(layout, 'isOutOfView');
}

/**
 * Map from a sub range to the greater view range, e.g, when the view range is
 * the middle half ([0.25, 0.75]), a value of 0.25 befomes 3/8.
 * @returns {number}
 */
function mapFromViewSubRange(viewStart: number, viewEnd: number, value: number) {
  return viewStart + value * (viewEnd - viewStart);
}

/**
 * Map a value from the view ([0, 1]) to a sub-range, e.g, when the view range is
 * the middle half ([0.25, 0.75]), a value of 3/8 becomes 1/4.
 * @returns {number}
 */
function mapToViewSubRange(viewStart: number, viewEnd: number, value: number) {
  return (value - viewStart) / (viewEnd - viewStart);
}

/**
 * Get the layout for the "next" view range time, e.g. the difference from the
 * drag start and the drag end. This is driven by `shiftStart`, `shiftEnd` or
 * `reframe` on `props.viewRangeTime`, not by the current state of the
 * component. So, it reflects in-progress dragging from the span minimap.
 */
function getNextViewLayout(start: number, position: number): TDraggingLeftLayout | TOutOfViewLayout {
  let [left, right] = start < position ? [start, position] : [position, start];
  if (left >= 1 || right <= 0) {
    return { isOutOfView: true };
  }
  if (left < 0) {
    left = 0;
  }
  if (right > 1) {
    right = 1;
  }
  return {
    isDraggingLeft: start > position,
    left: `${left * 100}%`,
    width: `${(right - left) * 100}%`,
  };
}

/**
 * Render the visual indication of the "next" view range.
 */
function getMarkers(viewStart: number, viewEnd: number, from: number, to: number, isShift: boolean): React.ReactNode {
  const mappedFrom = mapToViewSubRange(viewStart, viewEnd, from);
  const mappedTo = mapToViewSubRange(viewStart, viewEnd, to);
  const layout = getNextViewLayout(mappedFrom, mappedTo);
  if (isOutOfView(layout)) {
    return null;
  }
  const { isDraggingLeft, left, width } = layout;
  const styles = getStyles();
  const cls = cx({
    [styles.TimelineViewingLayerDraggedDraggingRight]: !isDraggingLeft,
    [styles.TimelineViewingLayerDraggedReframeDrag]: !isShift,
    [styles.TimelineViewingLayerDraggedShiftDrag]: isShift,
  });
  return (
    <div
      className={cx(styles.TimelineViewingLayerDragged, styles.TimelineViewingLayerDraggedDraggingLeft, cls)}
      style={{ left, width }}
      data-test-id="Dragged"
    />
  );
}

/**
 * `TimelineViewingLayer` is rendered on top of the TimelineHeaderRow time
 * labels; it handles showing the current view range and handles mouse UX for
 * modifying it.
 */
export default class TimelineViewingLayer extends React.PureComponent<TimelineViewingLayerProps> {
  _draggerReframe: DraggableManager;
  _root: Element | TNil;

  constructor(props: TimelineViewingLayerProps) {
    super(props);
    this._draggerReframe = new DraggableManager({
      getBounds: this._getDraggingBounds,
      onDragEnd: this._handleReframeDragEnd,
      onDragMove: this._handleReframeDragUpdate,
      onDragStart: this._handleReframeDragUpdate,
      onMouseLeave: this._handleReframeMouseLeave,
      onMouseMove: this._handleReframeMouseMove,
    });
    this._root = undefined;
  }

  componentWillReceiveProps(nextProps: TimelineViewingLayerProps) {
    const { boundsInvalidator } = this.props;
    if (boundsInvalidator !== nextProps.boundsInvalidator) {
      this._draggerReframe.resetBounds();
    }
  }

  componentWillUnmount() {
    this._draggerReframe.dispose();
  }

  _setRoot = (elm: Element | TNil) => {
    this._root = elm;
  };

  _getDraggingBounds = (): DraggableBounds => {
    if (!this._root) {
      throw new Error('invalid state');
    }
    const { left: clientXLeft, width } = this._root.getBoundingClientRect();
    return { clientXLeft, width };
  };

  _handleReframeMouseMove = ({ value }: DraggingUpdate) => {
    const [viewStart, viewEnd] = this.props.viewRangeTime.current;
    const cursor = mapFromViewSubRange(viewStart, viewEnd, value);
    this.props.updateNextViewRangeTime({ cursor });
  };

  _handleReframeMouseLeave = () => {
    this.props.updateNextViewRangeTime({ cursor: undefined });
  };

  _handleReframeDragUpdate = ({ value }: DraggingUpdate) => {
    const { current, reframe } = this.props.viewRangeTime;
    const [viewStart, viewEnd] = current;
    const shift = mapFromViewSubRange(viewStart, viewEnd, value);
    const anchor = reframe ? reframe.anchor : shift;
    const update = { reframe: { anchor, shift } };
    this.props.updateNextViewRangeTime(update);
  };

  _handleReframeDragEnd = ({ manager, value }: DraggingUpdate) => {
    const { current, reframe } = this.props.viewRangeTime;
    const [viewStart, viewEnd] = current;
    const shift = mapFromViewSubRange(viewStart, viewEnd, value);
    const anchor = reframe ? reframe.anchor : shift;
    const [start, end] = shift < anchor ? [shift, anchor] : [anchor, shift];
    manager.resetBounds();
    this.props.updateViewRangeTime(start, end, 'timeline-header');
  };

  render() {
    const { viewRangeTime } = this.props;
    const { current, cursor, reframe, shiftEnd, shiftStart } = viewRangeTime;
    const [viewStart, viewEnd] = current;
    const haveNextTimeRange = reframe != null || shiftEnd != null || shiftStart != null;
    let cusrorPosition: string | TNil;
    if (!haveNextTimeRange && cursor != null && cursor >= viewStart && cursor <= viewEnd) {
      cusrorPosition = `${mapToViewSubRange(viewStart, viewEnd, cursor) * 100}%`;
    }
    const styles = getStyles();
    return (
      <div
        aria-hidden
        className={styles.TimelineViewingLayer}
        ref={this._setRoot}
        onMouseDown={this._draggerReframe.handleMouseDown}
        onMouseLeave={this._draggerReframe.handleMouseLeave}
        onMouseMove={this._draggerReframe.handleMouseMove}
        data-test-id="TimelineViewingLayer"
      >
        {cusrorPosition != null && (
          <div
            className={styles.TimelineViewingLayerCursorGuide}
            style={{ left: cusrorPosition }}
            data-test-id="TimelineViewingLayer--cursorGuide"
          />
        )}
        {reframe != null && getMarkers(viewStart, viewEnd, reframe.anchor, reframe.shift, false)}
        {shiftEnd != null && getMarkers(viewStart, viewEnd, viewEnd, shiftEnd, true)}
        {shiftStart != null && getMarkers(viewStart, viewEnd, viewStart, shiftStart, true)}
      </div>
    );
  }
}

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

import { css, cx } from '@emotion/css';
import { memo, useLayoutEffect, useRef } from 'react';
import type * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import type TNil from '../../types/TNil';
import { type DraggableBounds, type DraggingUpdate } from '../../utils/DraggableManager/types';
import { useDraggableManager } from '../../utils/DraggableManager/useDraggableManager';
import { type TUpdateViewRangeTimeFunction, type ViewRangeTime, type ViewRangeTimeUpdate } from '../types';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    TimelineViewingLayer: css({
      label: 'TimelineViewingLayer',
      bottom: 0,
      cursor: 'vertical-text',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }),
    TimelineViewingLayerCursorGuide: css({
      label: 'TimelineViewingLayerCursorGuide',
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: '1px',
      backgroundColor: theme.colors.error.main,
    }),
    TimelineViewingLayerDragged: css({
      label: 'TimelineViewingLayerDragged',
      position: 'absolute',
      top: 0,
      bottom: 0,
    }),
    TimelineViewingLayerDraggedDraggingLeft: css({
      label: 'TimelineViewingLayerDraggedDraggingLeft',
      borderLeft: '1px solid',
    }),
    TimelineViewingLayerDraggedDraggingRight: css({
      label: 'TimelineViewingLayerDraggedDraggingRight',
      borderRight: '1px solid',
    }),
    TimelineViewingLayerDraggedShiftDrag: css({
      label: 'TimelineViewingLayerDraggedShiftDrag',
      backgroundColor: theme.colors.accent.subtleBackground,
      borderColor: theme.colors.accent.border,
    }),
    TimelineViewingLayerDraggedReframeDrag: css({
      label: 'TimelineViewingLayerDraggedReframeDrag',
      backgroundColor: theme.colors.error.subtleBackground,
      borderColor: theme.colors.error.border,
    }),
    TimelineViewingLayerFullOverlay: css({
      label: 'TimelineViewingLayerFullOverlay',
      bottom: 0,
      cursor: 'col-resize',
      left: 0,
      position: 'fixed',
      right: 0,
      top: 0,
      userSelect: 'none',
    }),
  };
};

export type TimelineViewingLayerProps = {
  /**
   * `boundsInvalidator` is an arbitrary prop that lets the component know the
   * bounds for dragging need to be recalculated. In practice, the name column
   * width serves fine for this.
   */
  boundsInvalidator: number | null | undefined;
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
function getMarkers(
  styles: ReturnType<typeof getStyles>,
  viewStart: number,
  viewEnd: number,
  from: number,
  to: number,
  isShift: boolean
): React.ReactNode {
  const mappedFrom = mapToViewSubRange(viewStart, viewEnd, from);
  const mappedTo = mapToViewSubRange(viewStart, viewEnd, to);
  const layout = getNextViewLayout(mappedFrom, mappedTo);
  if (isOutOfView(layout)) {
    return null;
  }
  const { isDraggingLeft, left, width } = layout;
  const cls = cx({
    [styles.TimelineViewingLayerDraggedDraggingRight]: !isDraggingLeft,
    [styles.TimelineViewingLayerDraggedReframeDrag]: !isShift,
    [styles.TimelineViewingLayerDraggedShiftDrag]: isShift,
  });
  return (
    <div
      className={cx(styles.TimelineViewingLayerDragged, styles.TimelineViewingLayerDraggedDraggingLeft, cls)}
      style={{ left, width }}
      data-testid="Dragged"
    />
  );
}

/**
 * `TimelineViewingLayer` is rendered on top of the TimelineHeaderRow time
 * labels; it handles showing the current view range and handles mouse UX for
 * modifying it.
 */
function TimelineViewingLayer({
  boundsInvalidator,
  updateNextViewRangeTime,
  updateViewRangeTime,
  viewRangeTime,
}: TimelineViewingLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const styles = useStyles2(getStyles);
  const { current, cursor, reframe, shiftEnd, shiftStart } = viewRangeTime;
  const [viewStart, viewEnd] = current;

  const getDraggingBounds = (): DraggableBounds => {
    if (!rootRef.current) {
      throw new Error('invalid state');
    }
    const { left: clientXLeft, width } = rootRef.current.getBoundingClientRect();
    return { clientXLeft, width };
  };

  const handleReframeMouseMove = ({ value }: DraggingUpdate) => {
    updateNextViewRangeTime({ cursor: mapFromViewSubRange(viewStart, viewEnd, value) });
  };

  const handleReframeMouseLeave = () => {
    updateNextViewRangeTime({ cursor: undefined });
  };

  const handleReframeDragUpdate = ({ value }: DraggingUpdate) => {
    const shift = mapFromViewSubRange(viewStart, viewEnd, value);
    const anchor = reframe ? reframe.anchor : shift;
    updateNextViewRangeTime({ reframe: { anchor, shift } });
  };

  const handleReframeDragEnd = ({ manager, value }: DraggingUpdate) => {
    const shift = mapFromViewSubRange(viewStart, viewEnd, value);
    const anchor = reframe ? reframe.anchor : shift;
    const [start, end] = shift < anchor ? [shift, anchor] : [anchor, shift];
    manager.resetBounds();
    updateViewRangeTime(start, end, 'timeline-header');
  };

  const dragger = useDraggableManager({
    getBounds: getDraggingBounds,
    onDragEnd: handleReframeDragEnd,
    onDragMove: handleReframeDragUpdate,
    onDragStart: handleReframeDragUpdate,
    onMouseLeave: handleReframeMouseLeave,
    onMouseMove: handleReframeMouseMove,
  });

  useLayoutEffect(() => {
    dragger.resetBounds();
  }, [dragger, boundsInvalidator]);

  const haveNextTimeRange = reframe != null || shiftEnd != null || shiftStart != null;
  let cursorPosition: string | TNil;
  if (!haveNextTimeRange && cursor != null && cursor >= viewStart && cursor <= viewEnd) {
    cursorPosition = `${mapToViewSubRange(viewStart, viewEnd, cursor) * 100}%`;
  }

  return (
    <div
      aria-hidden
      className={styles.TimelineViewingLayer}
      ref={rootRef}
      onMouseDown={dragger.onMouseDown}
      onMouseLeave={dragger.onMouseLeave}
      onMouseMove={dragger.onMouseMove}
      data-testid="TimelineViewingLayer"
    >
      {cursorPosition != null && (
        <div
          className={styles.TimelineViewingLayerCursorGuide}
          style={{ left: cursorPosition }}
          data-testid="TimelineViewingLayer--cursorGuide"
        />
      )}
      {reframe != null && getMarkers(styles, viewStart, viewEnd, reframe.anchor, reframe.shift, false)}
      {shiftEnd != null && getMarkers(styles, viewStart, viewEnd, viewEnd, shiftEnd, true)}
      {shiftStart != null && getMarkers(styles, viewStart, viewEnd, viewStart, shiftStart, true)}
    </div>
  );
}

export default memo(TimelineViewingLayer);

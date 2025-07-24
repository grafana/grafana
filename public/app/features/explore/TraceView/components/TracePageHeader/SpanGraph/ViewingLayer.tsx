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

import { css } from '@emotion/css';
import cx from 'classnames';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { withTheme2, stylesFactory, Button } from '@grafana/ui';

import { autoColor } from '../../Theme';
import { TUpdateViewRangeTimeFunction, ViewRangeTimeUpdate, ViewRange } from '../../TraceTimelineViewer/types';
import TNil from '../../types/TNil';
import DraggableManager from '../../utils/DraggableManager/DraggableManager';
import EUpdateTypes from '../../utils/DraggableManager/EUpdateTypes';
import { DraggableBounds, DraggingUpdate } from '../../utils/DraggableManager/types';

import GraphTicks from './GraphTicks';
import Scrubber from './Scrubber';

export const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  // Need this cause emotion will merge emotion generated classes into single className if used with cx from emotion
  // package and the selector won't work
  const ViewingLayerResetZoomHoverClassName = 'JaegerUiComponents__ViewingLayerResetZoomHoverClassName';
  const ViewingLayerResetZoom = css({
    label: 'ViewingLayerResetZoom',
    display: 'none',
    position: 'absolute',
    right: '1%',
    top: '10%',
    zIndex: 1,
  });

  return {
    ViewingLayer: css({
      label: 'ViewingLayer',
      cursor: 'vertical-text',
      position: 'relative',
      zIndex: 1,
      [`&:hover > .${ViewingLayerResetZoomHoverClassName}`]: {
        display: 'unset',
      },
    }),
    ViewingLayerGraph: css({
      label: 'ViewingLayerGraph',
      border: `1px solid ${autoColor(theme, '#999')}`,
      /* need !important here to overcome something from semantic UI */
      overflow: 'visible !important',
      position: 'relative',
      transformOrigin: '0 0',
      width: '100%',
    }),
    ViewingLayerInactive: css({
      label: 'ViewingLayerInactive',
      fill: autoColor(theme, 'rgba(214, 214, 214, 0.5)'),
    }),
    ViewingLayerCursorGuide: css({
      label: 'ViewingLayerCursorGuide',
      stroke: autoColor(theme, '#f44'),
      strokeWidth: 1,
    }),
    ViewingLayerDraggedShift: css({
      label: 'ViewingLayerDraggedShift',
      fillOpacity: 0.2,
    }),
    ViewingLayerDrag: css({
      label: 'ViewingLayerDrag',
      fill: autoColor(theme, '#44f'),
    }),
    ViewingLayerFullOverlay: css({
      label: 'ViewingLayerFullOverlay',
      bottom: 0,
      cursor: 'col-resize',
      left: 0,
      position: 'fixed',
      right: 0,
      top: 0,
      userSelect: 'none',
    }),
    ViewingLayerResetZoom,
    ViewingLayerResetZoomHoverClassName,
  };
});

export type ViewingLayerProps = {
  height: number;
  numTicks: number;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
  updateNextViewRangeTime: (update: ViewRangeTimeUpdate) => void;
  viewRange: ViewRange;
  theme: GrafanaTheme2;
};

type ViewingLayerState = {
  /**
   * Cursor line should not be drawn when the mouse is over the scrubber handle.
   */
  preventCursorLine: boolean;
};

/**
 * Designate the tags for the different dragging managers. Exported for tests.
 */
export const dragTypes = {
  /**
   * Tag for dragging the right scrubber, e.g. end of the current view range.
   */
  SHIFT_END: 'SHIFT_END',
  /**
   * Tag for dragging the left scrubber, e.g. start of the current view range.
   */
  SHIFT_START: 'SHIFT_START',
  /**
   * Tag for dragging a new view range.
   */
  REFRAME: 'REFRAME',
};

/**
 * Returns the layout information for drawing the view-range differential, e.g.
 * show what will change when the mouse is released. Basically, this is the
 * difference from the start of the drag to the current position.
 *
 * @returns {{ x: string, width: string, leadginX: string }}
 */
function getNextViewLayout(start: number, position: number) {
  const [left, right] = start < position ? [start, position] : [position, start];
  return {
    x: `${left * 100}%`,
    width: `${(right - left) * 100}%`,
    leadingX: `${position * 100}%`,
  };
}

/**
 * `ViewingLayer` is rendered on top of the Canvas rendering of the minimap and
 * handles showing the current view range and handles mouse UX for modifying it.
 */
export class UnthemedViewingLayer extends React.PureComponent<ViewingLayerProps, ViewingLayerState> {
  state: ViewingLayerState;

  _root: Element | TNil;

  /**
   * `_draggerReframe` handles clicking and dragging on the `ViewingLayer` to
   * redefined the view range.
   */
  _draggerReframe: DraggableManager;

  /**
   * `_draggerStart` handles dragging the left scrubber to adjust the start of
   * the view range.
   */
  _draggerStart: DraggableManager;

  /**
   * `_draggerEnd` handles dragging the right scrubber to adjust the end of
   * the view range.
   */
  _draggerEnd: DraggableManager;

  constructor(props: ViewingLayerProps) {
    super(props);

    this._draggerReframe = new DraggableManager({
      getBounds: this._getDraggingBounds,
      onDragEnd: this._handleReframeDragEnd,
      onDragMove: this._handleReframeDragUpdate,
      onDragStart: this._handleReframeDragUpdate,
      onMouseMove: this._handleReframeMouseMove,
      onMouseLeave: this._handleReframeMouseLeave,
      tag: dragTypes.REFRAME,
    });

    this._draggerStart = new DraggableManager({
      getBounds: this._getDraggingBounds,
      onDragEnd: this._handleScrubberDragEnd,
      onDragMove: this._handleScrubberDragUpdate,
      onDragStart: this._handleScrubberDragUpdate,
      onMouseEnter: this._handleScrubberEnterLeave,
      onMouseLeave: this._handleScrubberEnterLeave,
      tag: dragTypes.SHIFT_START,
    });

    this._draggerEnd = new DraggableManager({
      getBounds: this._getDraggingBounds,
      onDragEnd: this._handleScrubberDragEnd,
      onDragMove: this._handleScrubberDragUpdate,
      onDragStart: this._handleScrubberDragUpdate,
      onMouseEnter: this._handleScrubberEnterLeave,
      onMouseLeave: this._handleScrubberEnterLeave,
      tag: dragTypes.SHIFT_END,
    });

    this._root = undefined;
    this.state = {
      preventCursorLine: false,
    };
  }

  componentWillUnmount() {
    this._draggerReframe.dispose();
    this._draggerEnd.dispose();
    this._draggerStart.dispose();
  }

  _setRoot = (elm: SVGElement | TNil) => {
    this._root = elm;
  };

  _getDraggingBounds = (tag: string | TNil): DraggableBounds => {
    if (!this._root) {
      throw new Error('invalid state');
    }
    const { left: clientXLeft, width } = this._root.getBoundingClientRect();
    const [viewStart, viewEnd] = this.props.viewRange.time.current;
    let maxValue = 1;
    let minValue = 0;
    if (tag === dragTypes.SHIFT_START) {
      maxValue = viewEnd;
    } else if (tag === dragTypes.SHIFT_END) {
      minValue = viewStart;
    }
    return { clientXLeft, maxValue, minValue, width };
  };

  _handleReframeMouseMove = ({ value }: DraggingUpdate) => {
    this.props.updateNextViewRangeTime({ cursor: value });
  };

  _handleReframeMouseLeave = () => {
    this._draggerReframe.resetBounds();
    this.props.updateNextViewRangeTime({ cursor: null });
  };

  _handleReframeDragUpdate = ({ value }: DraggingUpdate) => {
    const shift = value;
    const { time } = this.props.viewRange;
    const anchor = time.reframe ? time.reframe.anchor : shift;
    const update = { reframe: { anchor, shift } };
    this.props.updateNextViewRangeTime(update);
  };

  _handleReframeDragEnd = ({ manager, value }: DraggingUpdate) => {
    const { time } = this.props.viewRange;
    const anchor = time.reframe ? time.reframe.anchor : value;
    const [start, end] = value < anchor ? [value, anchor] : [anchor, value];
    manager.resetBounds();
    this.props.updateViewRangeTime(start, end, 'minimap');
  };

  _handleScrubberEnterLeave = ({ type }: DraggingUpdate) => {
    const preventCursorLine = type === EUpdateTypes.MouseEnter;
    this.setState({ preventCursorLine });
  };

  _handleScrubberDragUpdate = ({ event, tag, type, value }: DraggingUpdate) => {
    if (type === EUpdateTypes.DragStart) {
      event.stopPropagation();
    }
    if (tag === dragTypes.SHIFT_START) {
      this.props.updateNextViewRangeTime({ shiftStart: value });
    } else if (tag === dragTypes.SHIFT_END) {
      this.props.updateNextViewRangeTime({ shiftEnd: value });
    }
  };

  _handleScrubberDragEnd = ({ manager, tag, value }: DraggingUpdate) => {
    const [viewStart, viewEnd] = this.props.viewRange.time.current;
    let update: [number, number];
    if (tag === dragTypes.SHIFT_START) {
      update = [value, viewEnd];
    } else if (tag === dragTypes.SHIFT_END) {
      update = [viewStart, value];
    } else {
      // to satisfy flow
      throw new Error('bad state');
    }
    manager.resetBounds();
    this.setState({ preventCursorLine: false });
    this.props.updateViewRangeTime(update[0], update[1], 'minimap');
  };

  /**
   * Resets the zoom to fully zoomed out.
   */
  _resetTimeZoomClickHandler = () => {
    this.props.updateViewRangeTime(0, 1);
  };

  /**
   * Renders the difference between where the drag started and the current
   * position, e.g. the red or blue highlight.
   *
   * @returns React.Node[]
   */
  _getMarkers(from: number, to: number) {
    const styles = getStyles(this.props.theme);
    const layout = getNextViewLayout(from, to);
    return [
      <rect
        key="fill"
        className={cx(styles.ViewingLayerDraggedShift, styles.ViewingLayerDrag)}
        x={layout.x}
        y="0"
        width={layout.width}
        height={this.props.height - 2}
      />,
      <rect
        key="edge"
        className={cx(styles.ViewingLayerDrag)}
        x={layout.leadingX}
        y="0"
        width="1"
        height={this.props.height - 2}
      />,
    ];
  }

  render() {
    const { height, viewRange, numTicks, theme } = this.props;
    const { preventCursorLine } = this.state;
    const { current, cursor, shiftStart, shiftEnd, reframe } = viewRange.time;
    const haveNextTimeRange = shiftStart != null || shiftEnd != null || reframe != null;
    const [viewStart, viewEnd] = current;
    let leftInactive = 0;
    if (viewStart) {
      leftInactive = viewStart * 100;
    }
    let rightInactive = 100;
    if (viewEnd) {
      rightInactive = 100 - viewEnd * 100;
    }
    let cursorPosition: string | undefined;
    if (!haveNextTimeRange && cursor != null && !preventCursorLine) {
      cursorPosition = `${cursor * 100}%`;
    }
    const styles = getStyles(theme);

    return (
      <div aria-hidden className={styles.ViewingLayer} style={{ height }}>
        {(viewStart !== 0 || viewEnd !== 1) && (
          <Button
            onClick={this._resetTimeZoomClickHandler}
            className={cx(styles.ViewingLayerResetZoom, styles.ViewingLayerResetZoomHoverClassName)}
            type="button"
            variant="secondary"
          >
            <Trans i18nKey="explore.unthemed-viewing-layer.reset-selection">Reset selection</Trans>
          </Button>
        )}
        <svg
          height={height}
          className={styles.ViewingLayerGraph}
          ref={this._setRoot}
          onMouseDown={this._draggerReframe.handleMouseDown}
          onMouseLeave={this._draggerReframe.handleMouseLeave}
          onMouseMove={this._draggerReframe.handleMouseMove}
        >
          {leftInactive > 0 && (
            <rect
              x={0}
              y={0}
              height="100%"
              width={`${leftInactive}%`}
              className={styles.ViewingLayerInactive}
              data-testid="left-ViewingLayerInactive"
            />
          )}
          {rightInactive > 0 && (
            <rect
              x={`${100 - rightInactive}%`}
              y={0}
              height="100%"
              width={`${rightInactive}%`}
              className={styles.ViewingLayerInactive}
              data-testid="right-ViewingLayerInactive"
            />
          )}
          <GraphTicks numTicks={numTicks} />
          {cursorPosition && (
            <line
              className={styles.ViewingLayerCursorGuide}
              x1={cursorPosition}
              y1="0"
              x2={cursorPosition}
              y2={height - 2}
              strokeWidth="1"
              data-testid="ViewingLayerCursorGuide"
            />
          )}
          {shiftStart != null && this._getMarkers(viewStart, shiftStart)}
          {shiftEnd != null && this._getMarkers(viewEnd, shiftEnd)}
          <Scrubber
            isDragging={shiftStart != null}
            onMouseDown={this._draggerStart.handleMouseDown}
            onMouseEnter={this._draggerStart.handleMouseEnter}
            onMouseLeave={this._draggerStart.handleMouseLeave}
            position={viewStart || 0}
          />
          <Scrubber
            isDragging={shiftEnd != null}
            position={viewEnd || 1}
            onMouseDown={this._draggerEnd.handleMouseDown}
            onMouseEnter={this._draggerEnd.handleMouseEnter}
            onMouseLeave={this._draggerEnd.handleMouseLeave}
          />
          {reframe != null && this._getMarkers(reframe.anchor, reframe.shift)}
        </svg>
        {/* fullOverlay updates the mouse cursor blocks mouse events */}
        {haveNextTimeRange && <div className={styles.ViewingLayerFullOverlay} />}
      </div>
    );
  }
}

export default withTheme2(UnthemedViewingLayer);

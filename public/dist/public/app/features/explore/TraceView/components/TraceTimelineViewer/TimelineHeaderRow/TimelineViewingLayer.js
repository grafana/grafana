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
import * as React from 'react';
import { stylesFactory } from '@grafana/ui';
import DraggableManager from '../../utils/DraggableManager';
// exported for testing
export const getStyles = stylesFactory(() => {
    return {
        TimelineViewingLayer: css `
      label: TimelineViewingLayer;
      bottom: 0;
      cursor: vertical-text;
      left: 0;
      position: absolute;
      right: 0;
      top: 0;
    `,
        TimelineViewingLayerCursorGuide: css `
      label: TimelineViewingLayerCursorGuide;
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 1px;
      background-color: red;
    `,
        TimelineViewingLayerDragged: css `
      label: TimelineViewingLayerDragged;
      position: absolute;
      top: 0;
      bottom: 0;
    `,
        TimelineViewingLayerDraggedDraggingLeft: css `
      label: TimelineViewingLayerDraggedDraggingLeft;
      border-left: 1px solid;
    `,
        TimelineViewingLayerDraggedDraggingRight: css `
      label: TimelineViewingLayerDraggedDraggingRight;
      border-right: 1px solid;
    `,
        TimelineViewingLayerDraggedShiftDrag: css `
      label: TimelineViewingLayerDraggedShiftDrag;
      background-color: rgba(68, 68, 255, 0.2);
      border-color: #44f;
    `,
        TimelineViewingLayerDraggedReframeDrag: css `
      label: TimelineViewingLayerDraggedReframeDrag;
      background-color: rgba(255, 68, 68, 0.2);
      border-color: #f44;
    `,
        TimelineViewingLayerFullOverlay: css `
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
function isOutOfView(layout) {
    return Reflect.has(layout, 'isOutOfView');
}
/**
 * Map from a sub range to the greater view range, e.g, when the view range is
 * the middle half ([0.25, 0.75]), a value of 0.25 befomes 3/8.
 * @returns {number}
 */
function mapFromViewSubRange(viewStart, viewEnd, value) {
    return viewStart + value * (viewEnd - viewStart);
}
/**
 * Map a value from the view ([0, 1]) to a sub-range, e.g, when the view range is
 * the middle half ([0.25, 0.75]), a value of 3/8 becomes 1/4.
 * @returns {number}
 */
function mapToViewSubRange(viewStart, viewEnd, value) {
    return (value - viewStart) / (viewEnd - viewStart);
}
/**
 * Get the layout for the "next" view range time, e.g. the difference from the
 * drag start and the drag end. This is driven by `shiftStart`, `shiftEnd` or
 * `reframe` on `props.viewRangeTime`, not by the current state of the
 * component. So, it reflects in-progress dragging from the span minimap.
 */
function getNextViewLayout(start, position) {
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
function getMarkers(viewStart, viewEnd, from, to, isShift) {
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
    return (React.createElement("div", { className: cx(styles.TimelineViewingLayerDragged, styles.TimelineViewingLayerDraggedDraggingLeft, cls), style: { left, width }, "data-testid": "Dragged" }));
}
/**
 * `TimelineViewingLayer` is rendered on top of the TimelineHeaderRow time
 * labels; it handles showing the current view range and handles mouse UX for
 * modifying it.
 */
export default class TimelineViewingLayer extends React.PureComponent {
    constructor(props) {
        super(props);
        this._setRoot = (elm) => {
            this._root = elm;
        };
        this._getDraggingBounds = () => {
            if (!this._root) {
                throw new Error('invalid state');
            }
            const { left: clientXLeft, width } = this._root.getBoundingClientRect();
            return { clientXLeft, width };
        };
        this._handleReframeMouseMove = ({ value }) => {
            const [viewStart, viewEnd] = this.props.viewRangeTime.current;
            const cursor = mapFromViewSubRange(viewStart, viewEnd, value);
            this.props.updateNextViewRangeTime({ cursor });
        };
        this._handleReframeMouseLeave = () => {
            this.props.updateNextViewRangeTime({ cursor: undefined });
        };
        this._handleReframeDragUpdate = ({ value }) => {
            const { current, reframe } = this.props.viewRangeTime;
            const [viewStart, viewEnd] = current;
            const shift = mapFromViewSubRange(viewStart, viewEnd, value);
            const anchor = reframe ? reframe.anchor : shift;
            const update = { reframe: { anchor, shift } };
            this.props.updateNextViewRangeTime(update);
        };
        this._handleReframeDragEnd = ({ manager, value }) => {
            const { current, reframe } = this.props.viewRangeTime;
            const [viewStart, viewEnd] = current;
            const shift = mapFromViewSubRange(viewStart, viewEnd, value);
            const anchor = reframe ? reframe.anchor : shift;
            const [start, end] = shift < anchor ? [shift, anchor] : [anchor, shift];
            manager.resetBounds();
            this.props.updateViewRangeTime(start, end, 'timeline-header');
        };
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
    UNSAFE_componentWillReceiveProps(nextProps) {
        const { boundsInvalidator } = this.props;
        if (boundsInvalidator !== nextProps.boundsInvalidator) {
            this._draggerReframe.resetBounds();
        }
    }
    componentWillUnmount() {
        this._draggerReframe.dispose();
    }
    render() {
        const { viewRangeTime } = this.props;
        const { current, cursor, reframe, shiftEnd, shiftStart } = viewRangeTime;
        const [viewStart, viewEnd] = current;
        const haveNextTimeRange = reframe != null || shiftEnd != null || shiftStart != null;
        let cusrorPosition;
        if (!haveNextTimeRange && cursor != null && cursor >= viewStart && cursor <= viewEnd) {
            cusrorPosition = `${mapToViewSubRange(viewStart, viewEnd, cursor) * 100}%`;
        }
        const styles = getStyles();
        return (React.createElement("div", { "aria-hidden": true, className: styles.TimelineViewingLayer, ref: this._setRoot, onMouseDown: this._draggerReframe.handleMouseDown, onMouseLeave: this._draggerReframe.handleMouseLeave, onMouseMove: this._draggerReframe.handleMouseMove, "data-testid": "TimelineViewingLayer" },
            cusrorPosition != null && (React.createElement("div", { className: styles.TimelineViewingLayerCursorGuide, style: { left: cusrorPosition }, "data-testid": "TimelineViewingLayer--cursorGuide" })),
            reframe != null && getMarkers(viewStart, viewEnd, reframe.anchor, reframe.shift, false),
            shiftEnd != null && getMarkers(viewStart, viewEnd, viewEnd, shiftEnd, true),
            shiftStart != null && getMarkers(viewStart, viewEnd, viewStart, shiftStart, true)));
    }
}
//# sourceMappingURL=TimelineViewingLayer.js.map
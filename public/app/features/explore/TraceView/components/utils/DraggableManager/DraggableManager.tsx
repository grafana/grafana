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

import { get as _get } from 'lodash';

import TNil from '../../types/TNil';

import EUpdateTypes from './EUpdateTypes';
import { DraggableBounds, DraggingUpdate } from './types';

const LEFT_MOUSE_BUTTON = 0;

export type DraggableManagerOptions = {
  getBounds: (tag: string | TNil) => DraggableBounds;
  onMouseEnter?: (update: DraggingUpdate) => void;
  onMouseLeave?: (update: DraggingUpdate) => void;
  onMouseMove?: (update: DraggingUpdate) => void;
  onDragStart?: (update: DraggingUpdate) => void;
  onDragMove?: (update: DraggingUpdate) => void;
  onDragEnd?: (update: DraggingUpdate) => void;
  resetBoundsOnResize?: boolean;
  tag?: string;
};

export default class DraggableManager {
  // cache the last known DraggableBounds (invalidate via `#resetBounds())
  _bounds: DraggableBounds | TNil;
  _isDragging: boolean;
  // optional callbacks for various dragging events
  _onMouseEnter: ((update: DraggingUpdate) => void) | TNil;
  _onMouseLeave: ((update: DraggingUpdate) => void) | TNil;
  _onMouseMove: ((update: DraggingUpdate) => void) | TNil;
  _onDragStart: ((update: DraggingUpdate) => void) | TNil;
  _onDragMove: ((update: DraggingUpdate) => void) | TNil;
  _onDragEnd: ((update: DraggingUpdate) => void) | TNil;
  // whether to reset the bounds on window resize
  _resetBoundsOnResize: boolean;

  /**
   * Get the `DraggableBounds` for the current drag. The returned value is
   * cached until either `#resetBounds()` is called or the window is resized
   * (assuming `_resetBoundsOnResize` is `true`). The `DraggableBounds` defines
   * the range the current drag can span to. It also establishes the left offset
   * to adjust `clientX` by (from the `MouseEvent`s).
   */
  getBounds: (tag: string | TNil) => DraggableBounds;

  // convenience data
  tag: string | TNil;

  // handlers for integration with DOM elements
  handleMouseEnter: (event: React.MouseEvent) => void;
  handleMouseMove: (event: React.MouseEvent) => void;
  handleMouseLeave: (event: React.MouseEvent) => void;
  handleMouseDown: (event: React.MouseEvent) => void;

  constructor({ getBounds, tag, resetBoundsOnResize = true, ...rest }: DraggableManagerOptions) {
    this.handleMouseDown = this._handleDragEvent;
    this.handleMouseEnter = this._handleMinorMouseEvent;
    this.handleMouseMove = this._handleMinorMouseEvent;
    this.handleMouseLeave = this._handleMinorMouseEvent;

    this.getBounds = getBounds;
    this.tag = tag;
    this._isDragging = false;
    this._bounds = undefined;
    this._resetBoundsOnResize = Boolean(resetBoundsOnResize);
    if (this._resetBoundsOnResize) {
      window.addEventListener('resize', this.resetBounds);
    }
    this._onMouseEnter = rest.onMouseEnter;
    this._onMouseLeave = rest.onMouseLeave;
    this._onMouseMove = rest.onMouseMove;
    this._onDragStart = rest.onDragStart;
    this._onDragMove = rest.onDragMove;
    this._onDragEnd = rest.onDragEnd;
  }

  _getBounds(): DraggableBounds {
    if (!this._bounds) {
      this._bounds = this.getBounds(this.tag);
    }
    return this._bounds;
  }

  _getPosition(clientX: number) {
    const { clientXLeft, maxValue, minValue, width } = this._getBounds();
    let x = clientX - clientXLeft;
    let value = x / width;
    if (minValue != null && value < minValue) {
      value = minValue;
      x = minValue * width;
    } else if (maxValue != null && value > maxValue) {
      value = maxValue;
      x = maxValue * width;
    }
    return { value, x };
  }

  _stopDragging() {
    window.removeEventListener('mousemove', this._handleDragEvent);
    window.removeEventListener('mouseup', this._handleDragEvent);
    const style = _get(document, 'body.style');
    if (style) {
      style.userSelect = 'auto';
    }
    this._isDragging = false;
  }

  isDragging() {
    return this._isDragging;
  }

  dispose() {
    if (this._isDragging) {
      this._stopDragging();
    }
    if (this._resetBoundsOnResize) {
      window.removeEventListener('resize', this.resetBounds);
    }
    this._bounds = undefined;
    this._onMouseEnter = undefined;
    this._onMouseLeave = undefined;
    this._onMouseMove = undefined;
    this._onDragStart = undefined;
    this._onDragMove = undefined;
    this._onDragEnd = undefined;
  }

  resetBounds = () => {
    this._bounds = undefined;
  };

  _handleMinorMouseEvent = (event: React.MouseEvent) => {
    const { button, clientX, type: eventType } = event;
    if (this._isDragging || button !== LEFT_MOUSE_BUTTON) {
      return;
    }
    let type: EUpdateTypes | null = null;
    let handler: ((update: DraggingUpdate) => void) | TNil;
    if (eventType === 'mouseenter') {
      type = EUpdateTypes.MouseEnter;
      handler = this._onMouseEnter;
    } else if (eventType === 'mouseleave') {
      type = EUpdateTypes.MouseLeave;
      handler = this._onMouseLeave;
    } else if (eventType === 'mousemove') {
      type = EUpdateTypes.MouseMove;
      handler = this._onMouseMove;
    } else {
      throw new Error(`invalid event type: ${eventType}`);
    }
    if (!handler) {
      return;
    }
    const { value, x } = this._getPosition(clientX);
    handler({
      event,
      type,
      value,
      x,
      manager: this,
      tag: this.tag,
    });
  };

  _handleDragEvent = (event: MouseEvent | React.MouseEvent) => {
    const { button, clientX, type: eventType } = event;
    let type: EUpdateTypes | null = null;
    let handler: ((update: DraggingUpdate) => void) | TNil;
    if (eventType === 'mousedown') {
      if (this._isDragging || button !== LEFT_MOUSE_BUTTON) {
        return;
      }
      window.addEventListener('mousemove', this._handleDragEvent);
      window.addEventListener('mouseup', this._handleDragEvent);
      const style = _get(document, 'body.style');
      if (style) {
        style.userSelect = 'none';
      }
      this._isDragging = true;

      type = EUpdateTypes.DragStart;
      handler = this._onDragStart;
    } else if (eventType === 'mousemove') {
      if (!this._isDragging) {
        return;
      }
      type = EUpdateTypes.DragMove;
      handler = this._onDragMove;
    } else if (eventType === 'mouseup') {
      if (!this._isDragging) {
        return;
      }
      this._stopDragging();
      type = EUpdateTypes.DragEnd;
      handler = this._onDragEnd;
    } else {
      throw new Error(`invalid event type: ${eventType}`);
    }
    if (!handler) {
      return;
    }
    const { value, x } = this._getPosition(clientX);
    handler({
      event,
      type,
      value,
      x,
      manager: this,
      tag: this.tag,
    });
  };
}

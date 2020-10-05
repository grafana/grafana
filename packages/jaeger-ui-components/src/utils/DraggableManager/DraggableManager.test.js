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

import DraggableManager from './DraggableManager';
import EUpdateTypes from './EUpdateTypes';

describe('DraggableManager', () => {
  const baseClientX = 100;
  // left button mouse events have `.button === 0`
  const baseMouseEvt = { button: 0, clientX: baseClientX };
  const tag = 'some-tag';
  let bounds;
  let getBounds;
  let ctorOpts;
  let instance;

  function startDragging(dragManager) {
    dragManager.handleMouseDown({ ...baseMouseEvt, type: 'mousedown' });
    expect(dragManager.isDragging()).toBe(true);
  }

  beforeEach(() => {
    bounds = {
      clientXLeft: 50,
      maxValue: 0.9,
      minValue: 0.1,
      width: 100,
    };
    getBounds = jest.fn(() => bounds);
    ctorOpts = {
      getBounds,
      tag,
      onMouseEnter: jest.fn(),
      onMouseLeave: jest.fn(),
      onMouseMove: jest.fn(),
      onDragStart: jest.fn(),
      onDragMove: jest.fn(),
      onDragEnd: jest.fn(),
      resetBoundsOnResize: false,
    };
    instance = new DraggableManager(ctorOpts);
  });

  describe('_getPosition()', () => {
    it('invokes the getBounds ctor argument', () => {
      instance._getPosition(0);
      expect(ctorOpts.getBounds.mock.calls).toEqual([[tag]]);
    });

    it('converts clientX to x and [0, 1] value', () => {
      const left = 100;
      const pos = instance._getPosition(left);
      expect(pos).toEqual({
        x: left - bounds.clientXLeft,
        value: (left - bounds.clientXLeft) / bounds.width,
      });
    });

    it('clamps x and [0, 1] value based on getBounds().minValue', () => {
      const left = 0;
      const pos = instance._getPosition(left);
      expect(pos).toEqual({
        x: bounds.minValue * bounds.width,
        value: bounds.minValue,
      });
    });

    it('clamps x and [0, 1] value based on getBounds().maxValue', () => {
      const left = 10000;
      const pos = instance._getPosition(left);
      expect(pos).toEqual({
        x: bounds.maxValue * bounds.width,
        value: bounds.maxValue,
      });
    });
  });

  describe('window resize event listener', () => {
    it('is added in the ctor iff `resetBoundsOnResize` param is truthy', () => {
      const oldFn = window.addEventListener;
      window.addEventListener = jest.fn();

      ctorOpts.resetBoundsOnResize = false;
      instance = new DraggableManager(ctorOpts);
      expect(window.addEventListener.mock.calls).toEqual([]);
      ctorOpts.resetBoundsOnResize = true;
      instance = new DraggableManager(ctorOpts);
      expect(window.addEventListener.mock.calls).toEqual([['resize', expect.any(Function)]]);

      window.addEventListener = oldFn;
    });

    it('is removed in `.dispose()` iff `resetBoundsOnResize` param is truthy', () => {
      const oldFn = window.removeEventListener;
      window.removeEventListener = jest.fn();

      ctorOpts.resetBoundsOnResize = false;
      instance = new DraggableManager(ctorOpts);
      instance.dispose();
      expect(window.removeEventListener.mock.calls).toEqual([]);
      ctorOpts.resetBoundsOnResize = true;
      instance = new DraggableManager(ctorOpts);
      instance.dispose();
      expect(window.removeEventListener.mock.calls).toEqual([['resize', expect.any(Function)]]);

      window.removeEventListener = oldFn;
    });
  });

  describe('minor mouse events', () => {
    it('throws an error for invalid event types', () => {
      const type = 'invalid-event-type';
      const throwers = [
        () => instance.handleMouseEnter({ ...baseMouseEvt, type }),
        () => instance.handleMouseMove({ ...baseMouseEvt, type }),
        () => instance.handleMouseLeave({ ...baseMouseEvt, type }),
      ];
      throwers.forEach(thrower => expect(thrower).toThrow());
    });

    it('does nothing if already dragging', () => {
      startDragging(instance);
      expect(getBounds.mock.calls.length).toBe(1);

      instance.handleMouseEnter({ ...baseMouseEvt, type: 'mouseenter' });
      instance.handleMouseMove({ ...baseMouseEvt, type: 'mousemove' });
      instance.handleMouseLeave({ ...baseMouseEvt, type: 'mouseleave' });
      expect(ctorOpts.onMouseEnter).not.toHaveBeenCalled();
      expect(ctorOpts.onMouseMove).not.toHaveBeenCalled();
      expect(ctorOpts.onMouseLeave).not.toHaveBeenCalled();

      const evt = { ...baseMouseEvt, type: 'invalid-type' };
      expect(() => instance.handleMouseEnter(evt)).not.toThrow();

      expect(getBounds.mock.calls.length).toBe(1);
    });

    it('passes data based on the mouse event type to callbacks', () => {
      const x = baseClientX - bounds.clientXLeft;
      const value = (baseClientX - bounds.clientXLeft) / bounds.width;
      const cases = [
        {
          type: 'mouseenter',
          handler: instance.handleMouseEnter,
          callback: ctorOpts.onMouseEnter,
          updateType: EUpdateTypes.MouseEnter,
        },
        {
          type: 'mousemove',
          handler: instance.handleMouseMove,
          callback: ctorOpts.onMouseMove,
          updateType: EUpdateTypes.MouseMove,
        },
        {
          type: 'mouseleave',
          handler: instance.handleMouseLeave,
          callback: ctorOpts.onMouseLeave,
          updateType: EUpdateTypes.MouseLeave,
        },
      ];

      cases.forEach(testCase => {
        const { type, handler, callback, updateType } = testCase;
        const event = { ...baseMouseEvt, type };
        handler(event);
        expect(callback.mock.calls).toEqual([[{ event, tag, value, x, manager: instance, type: updateType }]]);
      });
    });
  });

  describe('drag events', () => {
    let realWindowAddEvent;
    let realWindowRmEvent;

    beforeEach(() => {
      realWindowAddEvent = window.addEventListener;
      realWindowRmEvent = window.removeEventListener;
      window.addEventListener = jest.fn();
      window.removeEventListener = jest.fn();
    });

    afterEach(() => {
      window.addEventListener = realWindowAddEvent;
      window.removeEventListener = realWindowRmEvent;
    });

    it('throws an error for invalid event types', () => {
      expect(() => instance.handleMouseDown({ ...baseMouseEvt, type: 'invalid-event-type' })).toThrow();
    });

    describe('mousedown', () => {
      it('is ignored if already dragging', () => {
        startDragging(instance);
        window.addEventListener.mockReset();
        ctorOpts.onDragStart.mockReset();

        expect(getBounds.mock.calls.length).toBe(1);
        instance.handleMouseDown({ ...baseMouseEvt, type: 'mousedown' });
        expect(getBounds.mock.calls.length).toBe(1);

        expect(window.addEventListener).not.toHaveBeenCalled();
        expect(ctorOpts.onDragStart).not.toHaveBeenCalled();
      });

      it('sets `isDragging()` to true', () => {
        instance.handleMouseDown({ ...baseMouseEvt, type: 'mousedown' });
        expect(instance.isDragging()).toBe(true);
      });

      it('adds the window mouse listener events', () => {
        instance.handleMouseDown({ ...baseMouseEvt, type: 'mousedown' });
        expect(window.addEventListener.mock.calls).toEqual([
          ['mousemove', expect.any(Function)],
          ['mouseup', expect.any(Function)],
        ]);
      });
    });

    describe('mousemove', () => {
      it('is ignored if not already dragging', () => {
        instance._handleDragEvent({ ...baseMouseEvt, type: 'mousemove' });
        expect(ctorOpts.onDragMove).not.toHaveBeenCalled();
        startDragging(instance);
        instance._handleDragEvent({ ...baseMouseEvt, type: 'mousemove' });
        expect(ctorOpts.onDragMove).toHaveBeenCalled();
      });
    });

    describe('mouseup', () => {
      it('is ignored if not already dragging', () => {
        instance._handleDragEvent({ ...baseMouseEvt, type: 'mouseup' });
        expect(ctorOpts.onDragEnd).not.toHaveBeenCalled();
        startDragging(instance);
        instance._handleDragEvent({ ...baseMouseEvt, type: 'mouseup' });
        expect(ctorOpts.onDragEnd).toHaveBeenCalled();
      });

      it('sets `isDragging()` to false', () => {
        startDragging(instance);
        expect(instance.isDragging()).toBe(true);
        instance._handleDragEvent({ ...baseMouseEvt, type: 'mouseup' });
        expect(instance.isDragging()).toBe(false);
      });

      it('removes the window mouse listener events', () => {
        startDragging(instance);
        expect(window.removeEventListener).not.toHaveBeenCalled();
        instance._handleDragEvent({ ...baseMouseEvt, type: 'mouseup' });
        expect(window.removeEventListener.mock.calls).toEqual([
          ['mousemove', expect.any(Function)],
          ['mouseup', expect.any(Function)],
        ]);
      });
    });

    it('passes drag event data to the callbacks', () => {
      const x = baseClientX - bounds.clientXLeft;
      const value = (baseClientX - bounds.clientXLeft) / bounds.width;
      const cases = [
        {
          type: 'mousedown',
          handler: instance.handleMouseDown,
          callback: ctorOpts.onDragStart,
          updateType: EUpdateTypes.DragStart,
        },
        {
          type: 'mousemove',
          handler: instance._handleDragEvent,
          callback: ctorOpts.onDragMove,
          updateType: EUpdateTypes.DragMove,
        },
        {
          type: 'mouseup',
          handler: instance._handleDragEvent,
          callback: ctorOpts.onDragEnd,
          updateType: EUpdateTypes.DragEnd,
        },
      ];

      cases.forEach(testCase => {
        const { type, handler, callback, updateType } = testCase;
        const event = { ...baseMouseEvt, type };
        handler(event);
        expect(callback.mock.calls).toEqual([[{ event, tag, value, x, manager: instance, type: updateType }]]);
      });
    });
  });
});

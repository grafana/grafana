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

import Tween, { TweenState } from './Tween';

describe('Tween', () => {
  const oldNow = Date.now;
  const nowFn = jest.fn();
  const oldSetTimeout = window.setTimeout;
  const setTimeoutFn = jest.fn();
  const oldRaf = window.requestAnimationFrame;
  const rafFn = jest.fn();

  const baseOptions = { duration: 10, from: 0, to: 1 };

  jest.useFakeTimers();
  jest.spyOn(global, 'setTimeout');

  Date.now = nowFn;
  window.requestAnimationFrame = rafFn;

  beforeEach(() => {
    nowFn.mockReset();
    nowFn.mockReturnValue(0);
    setTimeoutFn.mockReset();
    rafFn.mockReset();
  });

  afterAll(() => {
    Date.now = oldNow;
    window.setTimeout = oldSetTimeout;
    window.requestAnimationFrame = oldRaf;
  });

  describe('ctor', () => {
    it('set startTime to the current time', () => {
      const n = Math.random();
      nowFn.mockReturnValue(n);
      const tween = new Tween(baseOptions);
      expect(tween.startTime).toBe(n);
    });

    it('adds delay to the startTime', () => {
      const n = Math.random();
      nowFn.mockReturnValue(n);
      const tween = new Tween({ ...baseOptions, delay: 10 });
      expect(tween.startTime).toBe(n + 10);
    });

    describe('with callbacks', () => {
      it('schedules setTimeout if there is a delay', () => {
        const delay = 10;
        const tween = new Tween({ ...baseOptions, delay, onUpdate: jest.fn() });
        expect(setTimeout).lastCalledWith(tween._frameCallback, delay);
      });

      it('schedules animation frame if there is not a delay', () => {
        const tween = new Tween({ ...baseOptions, onUpdate: jest.fn() });
        expect(rafFn).lastCalledWith(tween._frameCallback);
      });
    });
  });

  describe('getCurrent()', () => {
    it('returns `{done: false, value: from}` when time is before the delay is finished', () => {
      const tween = new Tween({ ...baseOptions, delay: 1 });
      const current = tween.getCurrent();
      expect(current).toEqual({ done: false, value: baseOptions.from });
    });

    describe('in progress tweens', () => {
      it('returns `{done: false...`}', () => {
        const tween = new Tween(baseOptions);
        nowFn.mockReturnValue(1);
        const current = tween.getCurrent();
        expect(current.done).toBe(false);
        expect(nowFn()).toBeLessThan(tween.startTime + tween.duration);
        expect(nowFn()).toBeGreaterThan(tween.startTime);
      });

      it('progresses `{..., value} as time progresses', () => {
        const tween = new Tween(baseOptions);
        let lastValue = tween.getCurrent().value;
        for (let i = 1; i < baseOptions.duration; i++) {
          nowFn.mockReturnValue(i);
          const { done, value } = tween.getCurrent();
          expect(done).toBe(false);
          expect(value).toBeGreaterThan(lastValue);
          lastValue = value;
        }
      });
    });

    it('returns `{done: true, value: to}` when the time is past the duration', () => {
      const tween = new Tween(baseOptions);
      nowFn.mockReturnValue(baseOptions.duration);
      const current = tween.getCurrent();
      expect(current).toEqual({ done: true, value: baseOptions.to });
    });
  });

  describe('_frameCallback', () => {
    it('freezes the callback argument', () => {
      let current: TweenState | undefined;
      const fn = jest.fn((_current) => {
        current = _current;
      });
      const tween = new Tween({ ...baseOptions, onUpdate: fn });
      tween._frameCallback();
      expect(current).toBeDefined();
      const copy = { ...current };
      try {
        current!.done = !current!.done;
        // eslint-disable-next-line no-empty
      } catch (_) {}
      expect(current).toEqual(copy);
    });

    it('calls onUpdate if there is an onUpdate callback', () => {
      const fn = jest.fn();
      const tween = new Tween({ ...baseOptions, onUpdate: fn });
      tween._frameCallback();
      const current = tween.getCurrent();
      expect(current).toBeDefined();
      expect(fn).lastCalledWith(current);
    });

    it('does not call onComplete if there is an onComplete callback and the tween is not complete', () => {
      const fn = jest.fn();
      const tween = new Tween({ ...baseOptions, onComplete: fn });
      tween._frameCallback();
      expect(fn.mock.calls.length).toBe(0);
    });

    it('calls onComplete if there is an onComplete callback and the tween is complete', () => {
      const fn = jest.fn();
      const tween = new Tween({ ...baseOptions, onComplete: fn });
      nowFn.mockReturnValue(nowFn() + baseOptions.duration);
      tween._frameCallback();
      const current = tween.getCurrent();
      expect(fn.mock.calls).toEqual([[current]]);
      expect(current.done).toBe(true);
    });

    it('schedules an animatinon frame if the tween is not complete', () => {
      expect(rafFn.mock.calls.length).toBe(0);
      const tween = new Tween({ ...baseOptions, onUpdate: () => {} });
      nowFn.mockReturnValue(nowFn() + 0.5 * baseOptions.duration);
      rafFn.mockReset();
      tween._frameCallback();
      expect(rafFn.mock.calls).toEqual([[tween._frameCallback]]);
    });
  });

  describe('cancel()', () => {
    it('cancels scheduled timeouts or animation frames', () => {
      const oldClearTimeout = window.clearTimeout;
      const oldCancelRaf = window.cancelAnimationFrame;
      const clearFn = jest.fn();
      window.clearTimeout = clearFn;
      const cancelFn = jest.fn();
      window.cancelAnimationFrame = cancelFn;

      const tween = new Tween(baseOptions);
      const id = 1;
      tween.timeoutID = id;
      tween.requestID = id;
      tween.cancel();
      expect(clearFn.mock.calls).toEqual([[id]]);
      expect(cancelFn.mock.calls).toEqual([[id]]);
      expect(tween.timeoutID).toBe(undefined);
      expect(tween.requestID).toBe(undefined);

      window.clearTimeout = oldClearTimeout;
      window.cancelAnimationFrame = oldCancelRaf;
    });

    it('releases references to callbacks', () => {
      const tween = new Tween({ ...baseOptions, onComplete: () => {}, onUpdate: () => {} });
      tween.cancel();
      expect(tween.onComplete).toBe(undefined);
      expect(tween.onUpdate).toBe(undefined);
    });
  });
});

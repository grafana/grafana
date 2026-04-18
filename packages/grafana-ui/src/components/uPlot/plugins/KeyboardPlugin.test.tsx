import { render } from '@testing-library/react';
import type uPlot from 'uplot';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { KeyboardPlugin } from './KeyboardPlugin';

describe('KeyboardPlugin', () => {
  let config: UPlotConfigBuilder;
  let addHookSpy: jest.SpyInstance;

  const createMockUPlot = () => {
    const root = document.createElement('div');
    const over = document.createElement('div');
    over.style.width = '100px';
    over.style.height = '200px';

    const setCursor = jest.fn();
    const setSelect = jest.fn();

    const mockU = {
      root,
      over,
      cursor: { left: 50, top: 100 },
      setCursor,
      setSelect,
      select: { left: 10, top: 0, width: 20, height: 200 },
      hooks: {} as { destroy?: Array<() => void> },
    } as unknown as uPlot;

    return { mockU, root, setCursor, setSelect };
  };

  beforeEach(() => {
    config = new UPlotConfigBuilder();
    addHookSpy = jest.spyOn(config, 'addHook');
  });

  afterEach(() => {
    addHookSpy.mockRestore();
  });

  it('registers init hook', () => {
    render(<KeyboardPlugin config={config} />);
    expect(addHookSpy).toHaveBeenCalledWith('init', expect.any(Function));
  });

  describe('init', () => {
    const runInit = () => {
      render(<KeyboardPlugin config={config} />);
      const initCallback = addHookSpy.mock.calls.find((call) => call[0] === 'init')?.[1] as (u: uPlot) => void;
      expect(initCallback).toBeDefined();
      return initCallback;
    };

    it('registers listeners', () => {
      const initCallback = runInit();
      const { mockU, root } = createMockUPlot();
      const addSpy = jest.spyOn(root, 'addEventListener');

      initCallback(mockU);

      expect(root.tabIndex).toBe(0);
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('blur', expect.any(Function));

      addSpy.mockRestore();
    });

    // Memory leak regression test: https://github.com/grafana/grafana/pull/53872
    it('registers destroy', () => {
      const initCallback = runInit();
      const { mockU, root } = createMockUPlot();
      const removeSpy = jest.spyOn(root, 'removeEventListener');

      initCallback(mockU);

      const onDestroy = mockU.hooks.destroy?.[0];
      expect(onDestroy).toBeDefined();
      onDestroy!(mockU);

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('blur', expect.any(Function));

      removeSpy.mockRestore();
    });
  });

  describe('keyboard interaction', () => {
    let rafQueue: FrameRequestCallback[] = [];
    let rafSpy: jest.SpyInstance;

    const setUp = () => {
      render(<KeyboardPlugin config={config} />);
      const initCallback = addHookSpy.mock.calls.find((call) => call[0] === 'init')?.[1] as (u: uPlot) => void;
      const { mockU, root, setCursor, setSelect } = createMockUPlot();
      initCallback(mockU);
      return { mockU, root, setCursor, setSelect };
    };

    beforeEach(() => {
      rafQueue = [];
      let id = 0;
      rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafQueue.push(cb);
        return ++id;
      });
    });

    afterEach(() => {
      rafSpy.mockRestore();
    });

    const flushRaf = (steps: number, timeStep = 16) => {
      let t = 0;
      for (let i = 0; i < steps; i++) {
        const batch = rafQueue.splice(0, rafQueue.length);
        if (batch.length === 0) {
          break;
        }
        t += timeStep;
        batch.forEach((cb) => cb(t));
      }
    };

    it('hides the cursor when Tab is pressed', () => {
      const { root, setCursor } = setUp();

      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      expect(setCursor).toHaveBeenCalledWith({ left: -5, top: -5 });
    });

    it('ignores unknown keys', () => {
      const { root } = setUp();
      const event = new KeyboardEvent('keydown', { key: 'q' });
      const preventSpy = jest.spyOn(event, 'preventDefault');

      root.dispatchEvent(event);

      expect(preventSpy).not.toHaveBeenCalled();
    });

    it('prevents default for known keys', () => {
      const { root } = setUp();
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      const preventSpy = jest.spyOn(event, 'preventDefault');

      root.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
    });

    it('moves the cursor while ArrowRight is held (animation frames)', () => {
      const { root, setCursor } = setUp();
      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      flushRaf(2);

      expect(setCursor.mock.calls.length).toBe(2);
      // 51.6 = 50(initial left) + 16(timestep) × 0.1(PIXELS_PER_MS)
      expect(setCursor.mock.calls[setCursor.mock.calls.length - 1]?.[0].left).toBe(51.6);
    });

    it('clears selection and key state on blur', () => {
      const { root, setSelect } = setUp();

      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      root.dispatchEvent(new FocusEvent('blur', { bubbles: false }));

      expect(setSelect).toHaveBeenCalledWith({ left: 0, top: 0, width: 0, height: 0 }, false);
    });

    it('centers the cursor on focus when :focus-visible matches', () => {
      const { root, setCursor } = setUp();
      const matchesSpy = jest.spyOn(root, 'matches').mockReturnValue(true);
      root.dispatchEvent(new FocusEvent('focus'));

      expect(setCursor).toHaveBeenCalledWith({ left: 50, top: 100 });
      matchesSpy.mockRestore();
    });

    it('does not move the cursor on focus when :focus-visible does not match', () => {
      const { root, setCursor } = setUp();
      const matchesSpy = jest.spyOn(root, 'matches').mockReturnValue(false);
      root.dispatchEvent(new FocusEvent('focus'));

      expect(setCursor).not.toHaveBeenCalled();
      matchesSpy.mockRestore();
    });

    it('on space keyup, refreshes selection and clears drag start', () => {
      const { root, mockU, setSelect } = setUp();
      root.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      flushRaf(2);
      root.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));

      expect(setSelect).toHaveBeenCalledWith(mockU.select);
    });
  });
});

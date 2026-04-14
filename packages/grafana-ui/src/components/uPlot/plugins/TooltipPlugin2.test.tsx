import { act, render, screen } from '@testing-library/react';
import type uPlot from 'uplot';

import { createTheme } from '@grafana/data';
import { DashboardCursorSync } from '@grafana/schema';

import { ScaleDirection, ScaleOrientation } from '../../../schema';
import { mockThemeContext } from '../../../themes/ThemeContext';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { TooltipHoverMode, TooltipPlugin2 } from './TooltipPlugin2';

describe('TooltipPlugin2', () => {
  let config: UPlotConfigBuilder;
  let addHookSpy: jest.SpyInstance;
  let restoreTheme: () => void;

  beforeEach(() => {
    config = new UPlotConfigBuilder();
    addHookSpy = jest.spyOn(config, 'addHook');
    restoreTheme = mockThemeContext(createTheme());
  });

  afterEach(() => {
    addHookSpy.mockRestore();
    restoreTheme();
  });

  const setUp = (
    uPlotOverrides?: Partial<uPlot>,
    tooltipOverrides?: Partial<React.ComponentProps<typeof TooltipPlugin2>>
  ) => {
    const view = render(
      <TooltipPlugin2
        config={config}
        hoverMode={TooltipHoverMode.xOne}
        render={() => <span>Tooltip content</span>}
        {...tooltipOverrides}
      />
    );

    const initCallback = addHookSpy.mock.calls.find((call) => call[0] === 'init')?.[1] as (u: uPlot) => void;
    const setSeriesCallback = addHookSpy.mock.calls.find((call) => call[0] === 'setSeries')?.[1] as (
      u: uPlot,
      seriesIdx: number | null
    ) => void;
    const readyCallback = addHookSpy.mock.calls.find((call) => call[0] === 'ready')?.[1] as () => void;
    const setLegendCallback = addHookSpy.mock.calls.find((call) => call[0] === 'setLegend')?.[1] as (u: uPlot) => void;
    const { mockUPlot, setCursor } = createMockUPlot(uPlotOverrides);

    return { view, mockUPlot, initCallback, setSeriesCallback, setCursor, readyCallback, setLegendCallback };
  };

  const createMockUPlot = (overrides?: Partial<uPlot>) => {
    const root = document.createElement('div');
    const over = document.createElement('div');
    const setCursor = jest.fn();

    const mockUPlot = {
      root,
      over,
      rect: { left: 0, top: 0, width: 800, height: 400, bottom: 400, right: 800 },
      cursor: {
        left: 50,
        top: 50,
        event: new MouseEvent('mousemove', { clientX: 100, clientY: 100 }),
        idxs: [null, 5],
        drag: { x: true, y: false, setScale: false },
      },
      scales: { x: { ori: 0 } },
      setCursor,
      select: { left: 0, top: 0, width: 0, height: 0 },
      ...overrides,
    } as unknown as uPlot;

    return { mockUPlot, setCursor };
  };

  describe('on hover', () => {
    it('renders', async () => {
      const { setSeriesCallback, initCallback, mockUPlot } = setUp();

      await act(async () => {
        initCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
      });

      expect(screen.getByText('Tooltip content')).toBeInTheDocument();
    });

    it('touch screen dispatches mousemove event on hover', async () => {
      const { setSeriesCallback, initCallback, mockUPlot } = setUp({
        cursor: {
          left: 50,
          top: 50,
          event: new MouseEvent('pointermove', { clientX: 100, clientY: 100 }),
          idxs: [null, 5],
          drag: { x: true, y: false, setScale: false },
        },
      });
      const dispatchEventSpy = jest.spyOn(mockUPlot.over, 'dispatchEvent');

      await act(async () => {
        initCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
      });

      expect(screen.getByText('Tooltip content')).toBeInTheDocument();
      expect(dispatchEventSpy).toHaveBeenCalled();

      const dispatched = dispatchEventSpy.mock.calls.map((call) => call[0]).find((ev) => ev.type === 'mousemove');
      expect(dispatched).toBeInstanceOf(MouseEvent);
      expect(dispatched?.type).toBe('mousemove');

      dispatchEventSpy.mockRestore();
    });

    it('desktop device sets uPlot cursor on hover', async () => {
      config.addScale({
        scaleKey: 'x',
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
        isTime: true,
      });

      const { setSeriesCallback, initCallback, mockUPlot, readyCallback, setLegendCallback, setCursor } = setUp(
        {
          cursor: {
            left: 44,
            top: 77,
            event: undefined,
            idxs: [null, 5],
            drag: { x: true, y: false, setScale: false },
          },
        },
        { syncMode: DashboardCursorSync.Tooltip }
      );

      await act(async () => {
        initCallback(mockUPlot);
        readyCallback();
        setLegendCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
      });

      expect(screen.getByText('Tooltip content')).toBeInTheDocument();
      expect(setCursor).toHaveBeenCalledWith({ left: 44, top: 77 }, true);
    });
  });

  describe('dataLinks', () => {
    it.todo('renders');
    it.todo('oneClick');
  });

  describe('housekeeping', () => {
    it('should disconnect observables on unmount', () => {
      const disconnectSpy = jest.spyOn(ResizeObserver.prototype, 'disconnect');

      const { view } = setUp();

      expect(disconnectSpy).not.toHaveBeenCalled();

      view.unmount();

      expect(disconnectSpy).toHaveBeenCalled();

      disconnectSpy.mockRestore();
    });

    it('should disconnect sizeRef observable on config change', async () => {
      const disconnectSpy = jest.spyOn(ResizeObserver.prototype, 'disconnect');
      const { view } = setUp();
      expect(disconnectSpy).not.toHaveBeenCalled();

      view.rerender(
        <TooltipPlugin2
          config={new UPlotConfigBuilder()}
          hoverMode={TooltipHoverMode.xOne}
          render={() => <span>Tooltip content</span>}
        />
      );

      expect(disconnectSpy).toHaveBeenCalled();
      disconnectSpy.mockRestore();
    });

    it('should clean up listeners on unmount', () => {
      const windowRemoveSpy = jest.spyOn(window, 'removeEventListener');
      const windowAddSpy = jest.spyOn(window, 'addEventListener');
      const documentRemoveSpy = jest.spyOn(document, 'removeEventListener');

      windowAddSpy.mockClear();
      windowRemoveSpy.mockClear();
      documentRemoveSpy.mockClear();

      const { view } = setUp();

      expect(windowAddSpy).toHaveBeenCalledTimes(2);
      view.unmount();

      expect(windowRemoveSpy).toHaveBeenCalledTimes(2);
      expect(windowRemoveSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(windowRemoveSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);

      expect(documentRemoveSpy).toHaveBeenCalledTimes(2);
      expect(documentRemoveSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), true);
      expect(documentRemoveSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);

      documentRemoveSpy.mockRestore();
      windowRemoveSpy.mockRestore();
      windowAddSpy.mockRestore();
    });

    it('should clean up event listeners added when tooltip is pinned', async () => {
      const documentAddSpy = jest.spyOn(document, 'addEventListener');
      const documentRemoveSpy = jest.spyOn(document, 'removeEventListener');
      const windowRemoveSpy = jest.spyOn(window, 'removeEventListener');
      const windowAddSpy = jest.spyOn(window, 'addEventListener');

      const pinnedDocCaptureAdds = (calls: typeof documentAddSpy.mock.calls) =>
        calls.filter((call) => (call[0] === 'mousedown' || call[0] === 'keydown') && call[2] === true);

      const { view, mockUPlot, initCallback, setSeriesCallback, setLegendCallback } = setUp();

      const docCaptureAddsAfterMount = pinnedDocCaptureAdds(documentAddSpy.mock.calls);
      const windowAddsAfterMount = windowAddSpy.mock.calls.length;

      await act(async () => {
        initCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
        setLegendCallback(mockUPlot);
        mockUPlot.over.dispatchEvent(new MouseEvent('click'));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const docCaptureAddsAfterPin = pinnedDocCaptureAdds(documentAddSpy.mock.calls);
      expect(docCaptureAddsAfterPin.length - docCaptureAddsAfterMount.length).toBe(2);
      expect(windowAddSpy.mock.calls.length).toBe(windowAddsAfterMount);

      const pinnedHandler = docCaptureAddsAfterPin.find((c) => c[0] === 'mousedown')?.[1] as (e: Event) => void;
      expect(pinnedHandler).toBe(docCaptureAddsAfterPin.find((c) => c[0] === 'keydown')?.[1]);

      documentRemoveSpy.mockClear();
      windowRemoveSpy.mockClear();

      view.unmount();

      expect(documentRemoveSpy).toHaveBeenCalledWith('mousedown', pinnedHandler, true);
      expect(documentRemoveSpy).toHaveBeenCalledWith('keydown', pinnedHandler, true);
      expect(documentRemoveSpy).toHaveBeenCalledTimes(2);
      expect(windowRemoveSpy).toHaveBeenCalledTimes(2);

      documentAddSpy.mockRestore();
      documentRemoveSpy.mockRestore();
      windowRemoveSpy.mockRestore();
      windowAddSpy.mockRestore();
    });

    it('registers u.over event listeners on init', () => {
      const { initCallback, mockUPlot } = setUp();
      const addSpy = jest.spyOn(mockUPlot.over, 'addEventListener');

      initCallback(mockUPlot);

      expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));

      addSpy.mockRestore();
    });

    // I wasn't able to repro u.over event listeners stacking up, but we're not currently cleaning them up
    it.todo('cleans up u.over event listeners on unmount');

    it('should dismiss tooltip on window scroll', async () => {
      const scrollContainer = document.createElement('div');
      const { setSeriesCallback, initCallback, mockUPlot, setLegendCallback } = setUp();

      scrollContainer.appendChild(mockUPlot.root);
      document.body.appendChild(scrollContainer);

      await act(async () => {
        initCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
        setLegendCallback(mockUPlot);
      });

      expect(screen.getByText('Tooltip content')).toBeInTheDocument();
      jest.mocked(mockUPlot.setCursor).mockClear();

      await act(async () => {
        scrollContainer.dispatchEvent(new Event('scroll'));
      });

      expect(mockUPlot.setCursor).toHaveBeenCalledWith({ left: -10, top: -10 });
    });

    it('should clean up mouseup listener (onUp)', () => {
      const docAddSpy = jest.spyOn(document, 'addEventListener');
      const docRemoveSpy = jest.spyOn(document, 'removeEventListener');

      const { initCallback, mockUPlot } = setUp(undefined, { clientZoom: true });

      initCallback(mockUPlot);

      docAddSpy.mockClear();
      docRemoveSpy.mockClear();

      mockUPlot.over.dispatchEvent(new MouseEvent('mousedown'));

      const mouseupAdds = docAddSpy.mock.calls.filter((call) => call[0] === 'mouseup');
      expect(mouseupAdds.length).toBe(1);
      expect(mouseupAdds[0][2]).toBe(true);
      const onUp = mouseupAdds[0][1] as (e: MouseEvent) => void;

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(docRemoveSpy).toHaveBeenCalledWith('mouseup', onUp, true);

      docAddSpy.mockRestore();
      docRemoveSpy.mockRestore();
    });
  });
});

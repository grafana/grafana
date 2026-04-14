import { act, render, screen } from '@testing-library/react';
import React from 'react';
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
    it('renders', async () => {
      const getDataLinks = jest.fn(() => [
        {
          href: 'https://example.com',
          title: 'Data link label',
          target: '_blank' as const,
          origin: {},
        },
      ]);

      const { setSeriesCallback, initCallback, mockUPlot, setLegendCallback } = setUp(undefined, {
        getDataLinks,
        render: (_u, _dataIdxs, _seriesIdx, _isPinned, _dismiss, _timeRange, _viaSync, dataLinks) => (
          <span>{dataLinks.length > 0 ? dataLinks[0].title : 'Tooltip content'}</span>
        ),
      });

      await act(async () => {
        initCallback(mockUPlot);
        setLegendCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
      });

      await act(async () => {
        mockUPlot.over.dispatchEvent(new MouseEvent('click'));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByText('Data link label')).toBeInTheDocument();
      expect(getDataLinks).toHaveBeenCalledWith(1, 5);
    });

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

    it('removes window resize listener on unmount', () => {
      const addSpy = jest.spyOn(window, 'addEventListener');
      const { view } = setUp();

      const resizeRegistration = addSpy.mock.calls.find((call) => call[0] === 'resize');
      expect(resizeRegistration).toBeDefined();
      const updateWinSize = resizeRegistration![1] as EventListener;

      addSpy.mockRestore();

      const removeSpy = jest.spyOn(window, 'removeEventListener');
      view.unmount();

      expect(removeSpy).toHaveBeenCalledWith('resize', updateWinSize);
      removeSpy.mockRestore();
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

      view.unmount();
    });

    it('should clean up event listeners added when tooltip is pinned', async () => {
      const { view, mockUPlot, initCallback, setSeriesCallback, setLegendCallback } = setUp();

      await act(async () => {
        initCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
        setLegendCallback(mockUPlot);
        mockUPlot.over.dispatchEvent(new MouseEvent('click'));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByText('Tooltip content')).toBeInTheDocument();
      view.unmount();
    });

    it('registers u.over event listeners on init', () => {
      const { view, initCallback, mockUPlot } = setUp();
      const addSpy = jest.spyOn(mockUPlot.over, 'addEventListener');

      initCallback(mockUPlot);

      expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));

      addSpy.mockRestore();
      view.unmount();
    });

    it('cleans up u.over event listeners after init when unmounted', async () => {
      const { view, mockUPlot, initCallback } = setUp();

      await act(async () => {
        initCallback(mockUPlot);
      });

      expect(mockUPlot.over).toBeInstanceOf(HTMLElement);
      view.unmount();
    });

    it('should dismiss tooltip on window scroll', async () => {
      const scrollContainer = document.createElement('div');
      const { view, setSeriesCallback, initCallback, mockUPlot, setLegendCallback } = setUp();

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

      document.body.removeChild(scrollContainer);
      view.unmount();
    });

    it('should clean up mouseup listener (onUp)', () => {
      const docAddSpy = jest.spyOn(document, 'addEventListener');
      const docRemoveSpy = jest.spyOn(document, 'removeEventListener');

      const { view, initCallback, mockUPlot } = setUp(undefined, { clientZoom: true });

      initCallback(mockUPlot);

      docAddSpy.mockClear();
      docRemoveSpy.mockClear();

      mockUPlot.over.dispatchEvent(new MouseEvent('mousedown'));
      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(docRemoveSpy).toHaveBeenCalledWith('mouseup', expect.any(Function), true);

      docAddSpy.mockRestore();
      docRemoveSpy.mockRestore();

      view.unmount();
    });
  });
});

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
    it.todo('should clean up listeners on unmount');
    it.todo('should dismiss tooltip on window scroll');
  });
});

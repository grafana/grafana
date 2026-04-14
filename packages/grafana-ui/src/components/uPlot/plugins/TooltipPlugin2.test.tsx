import { act, render, screen } from '@testing-library/react';
import type uPlot from 'uplot';

import { createTheme } from '@grafana/data';

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

  const setUp = (uPlotOverrides?: Partial<uPlot>) => {
    const view = render(
      <TooltipPlugin2 config={config} hoverMode={TooltipHoverMode.xOne} render={() => <span>Tooltip content</span>} />
    );

    const initCallback = addHookSpy.mock.calls.find((call) => call[0] === 'init')?.[1] as (u: uPlot) => void;
    const setSeriesCallback = addHookSpy.mock.calls.find((call) => call[0] === 'setSeries')?.[1] as (
      u: uPlot,
      seriesIdx: number | null
    ) => void;
    const { mockU: mockUPlot } = createMockUPlot(uPlotOverrides);

    return { view, mockUPlot, initCallback, setSeriesCallback };
  };

  const createMockUPlot = (overrides?: Partial<uPlot>) => {
    const root = document.createElement('div');
    const over = document.createElement('div');
    const setCursor = jest.fn();

    const mockU = {
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

    return { mockU, setCursor };
  };

  describe('on hover', () => {
    it('renders', async () => {
      const { setSeriesCallback, initCallback, mockUPlot } = setUp();

      await act(async () => {
        initCallback(mockUPlot);
      });

      await act(async () => {
        setSeriesCallback(mockUPlot, 1);
      });

      expect(screen.getByText('Tooltip content')).toBeInTheDocument();
    });

    it.todo('mobile device dispatches mousemove event on hover');
    it.todo('desktop device sets uPlot cursor on hover');
  });

  describe('housekeeping', () => {
    it.todo('should disconnect observables on unmount');
    it.todo('should clean up listeners on unmount');
    it.todo('should dismiss tooltip on window scroll');
  });
});

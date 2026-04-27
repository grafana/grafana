import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type uPlot from 'uplot';

import { createTheme } from '@grafana/data/themes';
import { DashboardCursorSync } from '@grafana/schema';

import { ScaleDirection, ScaleOrientation } from '../../../schema';
import { mockThemeContext } from '../../../themes/ThemeContext';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { TooltipHoverMode, TooltipPlugin2, TOOLTIP_OFFSET } from './TooltipPlugin2';

type UPlotConfigHookName = 'init' | 'ready' | 'setCursor' | 'setLegend' | 'setSeries' | 'setSelect';

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

    const getHook = (hookName: UPlotConfigHookName) =>
      addHookSpy.mock.calls.filter((call) => call[0] === hookName).at(-1)?.[1];

    const initCallback = getHook('init') as (u: uPlot) => void;
    const setSeriesCallback = getHook('setSeries') as (u: uPlot, seriesIdx: number | null) => void;
    const readyCallback = getHook('ready') as () => void;
    const setLegendCallback = getHook('setLegend') as (u: uPlot) => void;
    const { mockUPlot, setCursor } = createMockUPlot(uPlotOverrides);

    return { view, mockUPlot, initCallback, setSeriesCallback, setCursor, readyCallback, setLegendCallback, getHook };
  };

  /** Fresh object each call — init may mutate `cursor.drag` (e.g. clientZoom shift+mousedown). */
  const createDefaultMockCursor = (): uPlot.Cursor => ({
    left: 50,
    top: 50,
    event: new MouseEvent('mousemove', { clientX: 100, clientY: 100 }),
    idxs: [null, 5],
    drag: { x: true, y: false, setScale: false },
  });

  const createMockUPlot = (overrides?: Partial<uPlot>) => {
    const root = document.createElement('div');
    const over = document.createElement('div');
    const setCursor = jest.fn();
    const setSelect = jest.fn();
    const setScale = jest.fn();

    const mockUPlot = {
      root,
      over,
      rect: { left: 0, top: 0, width: 800, height: 400, bottom: 400, right: 800 },
      cursor: createDefaultMockCursor(),
      scales: { x: { ori: 0 } },
      setCursor,
      setScale,
      setSelect,
      select: { left: 0, top: 0, width: 0, height: 0 },
      ...overrides,
    } as uPlot;

    return { mockUPlot, setCursor };
  };

  const renderFirstDataLinkTitle: React.ComponentProps<typeof TooltipPlugin2>['render'] = (
    _u,
    _dataIdxs,
    _seriesIdx,
    _isPinned,
    _dismiss,
    _timeRange,
    _viaSync,
    dataLinks
  ) => <span>{dataLinks.length > 0 ? dataLinks[0].title : 'Tooltip content'}</span>;

  const getTooltipWrapper = () => screen.getByText('Tooltip content').parentElement;

  const expectedTooltipTransform = (u: uPlot) => {
    const left = u.cursor.left ?? -10;
    const top = u.cursor.top ?? -10;
    const shiftX = u.rect.left + left + TOOLTIP_OFFSET;
    const shiftY = u.rect.top + top + TOOLTIP_OFFSET;
    return `translateX(${shiftX}px)  translateY(${shiftY}px) `;
  };

  /** DOM / React may normalize whitespace on `style.transform`. */
  const normalizeCssTransform = (value: string | undefined) => value?.replace(/\s+/g, ' ').trim() ?? '';

  const identityPosToVal = () => jest.fn((pos: number) => pos);

  const expectUPlotSelectCleared = (mockUPlot: uPlot) => {
    expect(mockUPlot.setSelect).toHaveBeenCalledWith({ left: 0, width: 0, top: 0, height: 0 }, false);
  };

  const getSetSelectHook = (getHook: (name: UPlotConfigHookName) => (u: uPlot) => void) => getHook('setSelect');

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
        cursor: createDefaultMockCursor(),
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

  describe('clientZoom', () => {
    it('zooms y-axis without issuing query', async () => {
      const posToVal = identityPosToVal();
      const queryZoom = jest.fn();

      const { initCallback, mockUPlot, getHook } = setUp(
        {
          cursor: createDefaultMockCursor(),
          select: { left: 0, top: 10, width: 0, height: 50 },
          posToVal,
          scales: { x: { ori: 0 }, y: {} },
        },
        { clientZoom: true, queryZoom }
      );

      const setSelectHook = getSetSelectHook(getHook);

      await act(async () => {
        initCallback(mockUPlot);
        // y-only zoom uses outer `yDrag` set by shift+mousedown (see TooltipPlugin2 init + setSelect).
        mockUPlot.over.dispatchEvent(
          new MouseEvent('mousedown', { button: 0, shiftKey: true, clientX: 100, clientY: 100 })
        );
        setSelectHook(mockUPlot);
      });

      expect(mockUPlot.setScale).toHaveBeenCalledWith('y', { min: 60, max: 10 });
      expect(queryZoom).not.toHaveBeenCalled();
      expectUPlotSelectCleared(mockUPlot);
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
        render: renderFirstDataLinkTitle,
      });

      await act(async () => {
        initCallback(mockUPlot);
        setLegendCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
      });

      await act(async () => {
        mockUPlot.over.dispatchEvent(new MouseEvent('click'));
      });

      await waitFor(() => {
        expect(screen.getByText('Data link label')).toBeInTheDocument();
      });
      expect(getDataLinks).toHaveBeenCalledWith(1, 5);
    });

    it('oneClick', async () => {
      const windowOpen = jest.spyOn(window, 'open').mockImplementation(() => null);

      const getDataLinks = jest.fn(() => [
        {
          href: 'https://example.com/oneclick',
          title: 'One-click link',
          target: '_blank' as const,
          origin: {},
          oneClick: true,
        },
      ]);

      const { setSeriesCallback, initCallback, mockUPlot, setLegendCallback } = setUp(undefined, {
        getDataLinks,
        render: renderFirstDataLinkTitle,
      });

      await act(async () => {
        initCallback(mockUPlot);
        setLegendCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
      });

      await act(async () => {
        mockUPlot.over.dispatchEvent(new MouseEvent('click'));
      });

      expect(windowOpen).toHaveBeenCalledWith('https://example.com/oneclick', '_blank');
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
      expect(getDataLinks).toHaveBeenCalledWith(1, 5);

      windowOpen.mockRestore();
    });
  });

  describe('setCursor', () => {
    it('sets transform', async () => {
      const { setSeriesCallback, initCallback, mockUPlot, setLegendCallback, getHook } = setUp();
      const setCursorHook = getHook('setCursor') as (u: uPlot) => void;

      await act(async () => {
        initCallback(mockUPlot);
        setLegendCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
      });

      act(() => {
        setCursorHook(mockUPlot);
      });

      expect(normalizeCssTransform(getTooltipWrapper()?.style.transform)).toBe(
        normalizeCssTransform(expectedTooltipTransform(mockUPlot))
      );
    });

    it('schedules render', async () => {
      const { setSeriesCallback, initCallback, mockUPlot, setLegendCallback, getHook } = setUp();
      const setCursorHook = getHook('setCursor') as (u: uPlot) => void;

      await act(async () => {
        initCallback(mockUPlot);
        setLegendCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
        // Before the hover microtask runs and the portaled tooltip mounts, `domRef` is still null;
        // setCursor then updates `_style` and calls `scheduleRender()` (TooltipPlugin2 setCursor hook).
        setCursorHook(mockUPlot);
      });

      expect(normalizeCssTransform(getTooltipWrapper()?.style.transform)).toBe(
        normalizeCssTransform(expectedTooltipTransform(mockUPlot))
      );
    });
  });

  describe('setSelect', () => {
    it('xDrag', async () => {
      const onSelectRange = jest.fn();
      const queryZoom = jest.fn();
      const posToVal = identityPosToVal();

      const { initCallback, mockUPlot, getHook } = setUp(
        {
          cursor: createDefaultMockCursor(),
          select: { left: 10, width: 50, top: 0, height: 0 },
          posToVal,
        },
        { queryZoom, onSelectRange }
      );

      const setSelectHook = getSetSelectHook(getHook);

      await act(async () => {
        initCallback(mockUPlot);
        setSelectHook(mockUPlot);
      });

      expect(onSelectRange).toHaveBeenCalledWith([{ x: { from: 10, to: 60 } }]);
      expect(queryZoom).not.toHaveBeenCalled();
      expectUPlotSelectCleared(mockUPlot);
    });

    it('yDrag', async () => {
      config.addScale({
        scaleKey: 'y',
        orientation: ScaleOrientation.Vertical,
        direction: ScaleDirection.Up,
        isTime: false,
      });

      const onSelectRange = jest.fn();
      const queryZoom = jest.fn();
      const posToVal = identityPosToVal();

      const { initCallback, mockUPlot, getHook } = setUp(
        {
          cursor: { ...createDefaultMockCursor(), drag: { x: false, y: true, setScale: false } },
          select: { left: 0, top: 10, width: 0, height: 50 },
          posToVal,
        },
        { queryZoom, onSelectRange }
      );

      const setSelectHook = getSetSelectHook(getHook);

      await act(async () => {
        initCallback(mockUPlot);
        setSelectHook(mockUPlot);
      });

      expect(onSelectRange).toHaveBeenCalledWith([{ y: { from: 60, to: 10 } }]);
      expect(queryZoom).not.toHaveBeenCalled();
      expectUPlotSelectCleared(mockUPlot);
    });
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
      const updateWinSize = resizeRegistration![1];

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

    it('removes document outside-click listeners on unmount after tooltip is pinned', async () => {
      const removeSpy = jest.spyOn(document, 'removeEventListener');
      const { view, mockUPlot, initCallback, setSeriesCallback, setLegendCallback } = setUp();

      await act(async () => {
        initCallback(mockUPlot);
        setSeriesCallback(mockUPlot, 1);
        setLegendCallback(mockUPlot);
        mockUPlot.over.dispatchEvent(new MouseEvent('click'));
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      });

      removeSpy.mockClear();
      view.unmount();

      expect(removeSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), true);
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);

      removeSpy.mockRestore();
    });

    it('registers u.over event listeners on init', () => {
      const { view, initCallback, mockUPlot } = setUp();
      const addSpy = jest.spyOn(mockUPlot.over, 'addEventListener');

      initCallback(mockUPlot);

      expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));

      addSpy.mockRestore();
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

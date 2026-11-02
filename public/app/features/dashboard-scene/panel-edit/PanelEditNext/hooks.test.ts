import { act, renderHook } from '@testing-library/react';
import type React from 'react';

import { useTheme2 } from '@grafana/ui';

import { useSidebarCollapsed } from '../../sidebar/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import type { PanelEditor } from '../PanelEditor';
import { useSnappingSplitter } from '../splitter/useSnappingSplitter';
import { useScrollReflowLimit } from '../useScrollReflowLimit';

import { buildVizAndDataPaneGrid, getDefaultSidebarRatio, usePanelEditorShell, useRatioResize } from './hooks';

jest.mock('@grafana/ui', () => ({
  useStyles2: jest.fn(() => ({ dragHandleVertical: 'drag-v', dragHandleHorizontal: 'drag-h' })),
  getDragStyles: jest.fn(),
  useTheme2: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({ config: { featureToggles: {} } }));

// Prevent heavy transitive imports (@grafana/scenes, @grafana/runtime) from loading.
jest.mock('./constants', () => ({
  SidebarSize: { Mini: 'mini', Full: 'full' },
  QUERY_EDITOR_SIDEBAR_SIZE_KEY: 'grafana.dashboard.query-editor-next.sidebar-size',
  QUERY_EDITOR_BANNER_DISMISSED_KEY: 'grafana.dashboard.query-editor-next.banner-dismissed',
}));
jest.mock('../../sidebar/shared', () => ({ useSidebarCollapsed: jest.fn() }));
jest.mock('../../utils/utils', () => ({ getDashboardSceneFor: jest.fn() }));
jest.mock('../PanelEditor', () => ({}));
jest.mock('../splitter/useSnappingSplitter', () => ({ useSnappingSplitter: jest.fn() }));
jest.mock('../useScrollReflowLimit', () => ({ useScrollReflowLimit: jest.fn() }));

describe('usePanelEditorShell', () => {
  it('subscribes to and returns dashboard controls', () => {
    const controls = { Component: jest.fn() };
    const dashboard = { useState: jest.fn(() => ({ controls })) };
    const optionsPane = { Component: jest.fn() };
    const model = { useState: jest.fn(() => ({ optionsPane })) } as unknown as PanelEditor;
    const setIsCollapsed = jest.fn();
    const splitter = { splitterState: { collapsed: false } };

    jest.mocked(getDashboardSceneFor).mockReturnValue(dashboard as never);
    jest.mocked(useSidebarCollapsed).mockReturnValue([true, setIsCollapsed]);
    jest.mocked(useScrollReflowLimit).mockReturnValue(false);
    jest.mocked(useTheme2).mockReturnValue({ spacing: jest.fn(() => '16px') } as never);
    jest.mocked(useSnappingSplitter).mockReturnValue(splitter as never);

    const { result } = renderHook(() => usePanelEditorShell(model));

    expect(dashboard.useState).toHaveBeenCalled();
    expect(useSnappingSplitter).toHaveBeenCalledWith(
      expect.objectContaining({
        collapsed: true,
        direction: 'row',
        disabled: false,
      })
    );
    expect(setIsCollapsed).toHaveBeenCalledWith(false);
    expect(result.current).toEqual({
      dashboard,
      optionsPane,
      isScrollingLayout: false,
      splitter,
      controls,
    });
  });
});

describe('buildVizAndDataPaneGrid', () => {
  const base = {
    hasDataPane: true,
    isSidebarFullWidth: false,
    showBanner: true,
    vizRatio: 0.5,
    sidebarRatio: 0.25,
  };

  it('produces only a viz row when there is no data pane', () => {
    const { gridTemplateAreas } = buildVizAndDataPaneGrid({ ...base, hasDataPane: false });

    expect(gridTemplateAreas).toBe('"viz viz"');
  });

  it('makes sidebar span every row when isSidebarFullWidth is true', () => {
    const { gridTemplateAreas } = buildVizAndDataPaneGrid({ ...base, isSidebarFullWidth: true });

    expect(gridTemplateAreas).toBe('"sidebar viz"\n"sidebar version-toggle"\n"sidebar data-pane"');
  });

  it('omits version-toggle row when showBanner is false', () => {
    const { gridTemplateAreas, gridTemplateRows } = buildVizAndDataPaneGrid({ ...base, showBanner: false });

    expect(gridTemplateAreas).toBe('"viz viz"\n"sidebar data-pane"');
    expect(gridTemplateRows).toBe('1fr 1fr');
  });

  it('converts vizRatio to fractional row height — ratio / (1 - ratio)', () => {
    // 0.5 → 1fr (equal split), 0.75 → 3fr (3x taller than data pane)
    expect(buildVizAndDataPaneGrid({ ...base, vizRatio: 0.5 }).gridTemplateRows).toBe('1fr auto 1fr');
    expect(buildVizAndDataPaneGrid({ ...base, vizRatio: 0.75 }).gridTemplateRows).toBe('3fr auto 1fr');
  });

  it('converts sidebarRatio 0.5 to equal columns (minmax(200px, 1fr) 1fr)', () => {
    expect(buildVizAndDataPaneGrid({ ...base, sidebarRatio: 0.5 }).gridTemplateColumns).toBe('minmax(200px, 1fr) 1fr');
  });

  it('converts sidebarRatio 0.25 to approximately one-third of the available width', () => {
    // 0.25 / (1 - 0.25) = 0.333...fr — wrapped in minmax(200px, Xfr)
    const columns = buildVizAndDataPaneGrid({ ...base, sidebarRatio: 0.25 }).gridTemplateColumns;
    const match = columns.match(/minmax\(\d+px,\s*([\d.]+)fr\)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeCloseTo(1 / 3, 5);
  });
});

describe('getDefaultSidebarRatio', () => {
  it.each([
    [300, 150, 'the 50% drag maximum when the 200px floor would exceed it'],
    [1000, 200, 'the 200px floor when 18% would be narrower'],
    [1399, 251.82, '18% just below the 1400px breakpoint'],
    [1400, 280, '20% at the 1400px breakpoint'],
    [1650, 330, '20% reaching the 330px cap'],
    [3000, 330, 'the 330px cap on large screens'],
    [4000, 400, 'the 10% drag minimum once the cap would go below it'],
  ])('gives a %spx container a %spx sidebar (%s)', (width, expectedPixels) => {
    expect(getDefaultSidebarRatio(width) * width).toBeCloseTo(expectedPixels, 2);
  });

  it('never shrinks the sidebar as the container grows', () => {
    let previousPixels = 0;
    for (let width = 800; width <= 4000; width++) {
      const pixels = getDefaultSidebarRatio(width) * width;
      expect(pixels).toBeGreaterThan(previousPixels - 1e-9);
      previousPixels = pixels;
    }
  });
});

describe('useRatioResize', () => {
  function setContainerSize(el: HTMLElement, width: number, height: number) {
    el.getBoundingClientRect = () => ({
      width,
      height,
      top: 0,
      left: 0,
      bottom: height,
      right: width,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
  }

  function makeContainerRef(width: number, height: number): React.RefObject<HTMLElement> {
    const el = document.createElement('div');
    setContainerSize(el, width, height);
    return { current: el };
  }

  it('applies getDefaultRatio using the measured container width', () => {
    const getDefaultRatio = jest.fn(() => 0.2);
    const containerRef = makeContainerRef(1200, 600);

    const { result } = renderHook(() =>
      useRatioResize({ direction: 'horizontal', initialRatio: 0.5, containerRef, getDefaultRatio })
    );

    expect(getDefaultRatio).toHaveBeenCalledWith(1200);
    expect(result.current.ratio).toBe(0.2);
  });

  it('applies getDefaultRatio using the measured container height when direction is vertical', () => {
    const getDefaultRatio = jest.fn(() => 0.3);
    const containerRef = makeContainerRef(1200, 600);

    const { result } = renderHook(() =>
      useRatioResize({ direction: 'vertical', initialRatio: 0.5, containerRef, getDefaultRatio })
    );

    expect(getDefaultRatio).toHaveBeenCalledWith(600);
    expect(result.current.ratio).toBe(0.3);
  });

  it('does not apply getDefaultRatio when the container has no size — avoids incorrect ratio before layout', () => {
    const getDefaultRatio = jest.fn(() => 0.2);
    const containerRef = makeContainerRef(0, 0);

    const { result } = renderHook(() =>
      useRatioResize({ direction: 'horizontal', initialRatio: 0.5, containerRef, getDefaultRatio })
    );

    expect(getDefaultRatio).not.toHaveBeenCalled();
    expect(result.current.ratio).toBe(0.5);
  });

  describe('on container resize', () => {
    let notifyResize: VoidFunction;
    let disconnect: jest.Mock;
    let resizeObserverSpy: jest.SpyInstance;

    beforeEach(() => {
      disconnect = jest.fn();
      resizeObserverSpy = jest
        .spyOn(globalThis, 'ResizeObserver')
        .mockImplementation((callback: ResizeObserverCallback) => {
          const observer: ResizeObserver = { observe: jest.fn(), unobserve: jest.fn(), disconnect };
          notifyResize = () => callback([], observer);
          return observer;
        });
    });

    afterEach(() => {
      resizeObserverSpy.mockRestore();
    });

    const getDefaultRatio = (width: number) => (width >= 2000 ? 0.15 : 0.25);

    function resizeContainer(containerRef: React.RefObject<HTMLElement>, width: number) {
      setContainerSize(containerRef.current!, width, 600);
      act(() => notifyResize());
    }

    // jsdom has no PointerEvent, and fireEvent drops clientX on the generic Event it falls back to.
    function firePointer(handle: HTMLElement, type: string, clientX: number) {
      act(() => {
        handle.dispatchEvent(new MouseEvent(type, { clientX, cancelable: true }));
      });
    }

    function renderWithHandle(containerRef: React.RefObject<HTMLElement>) {
      const handle = document.createElement('div');
      handle.setPointerCapture = jest.fn();
      handle.releasePointerCapture = jest.fn();
      handle.hasPointerCapture = jest.fn(() => true);
      const rendered = renderHook(() =>
        useRatioResize({ direction: 'horizontal', initialRatio: 0.5, containerRef, getDefaultRatio })
      );
      act(() => rendered.result.current.handleRef(handle));
      return { ...rendered, handle };
    }

    it('re-applies getDefaultRatio with the new container width', () => {
      const containerRef = makeContainerRef(2400, 600);
      const { result } = renderWithHandle(containerRef);
      expect(result.current.ratio).toBe(0.15);

      resizeContainer(containerRef, 1200);

      expect(result.current.ratio).toBe(0.25);
    });

    it('keeps the dragged ratio when the container resizes afterwards', () => {
      const containerRef = makeContainerRef(2400, 600);
      const { result, handle } = renderWithHandle(containerRef);

      firePointer(handle, 'pointerdown', 0);
      firePointer(handle, 'pointermove', 120);
      firePointer(handle, 'pointerup', 120);
      resizeContainer(containerRef, 1200);

      expect(result.current.ratio).toBeCloseTo(0.2);
    });

    it('keeps responding to resizes after a click on the handle without dragging', () => {
      const containerRef = makeContainerRef(2400, 600);
      const { result, handle } = renderWithHandle(containerRef);

      firePointer(handle, 'pointerdown', 0);
      firePointer(handle, 'pointerup', 0);
      resizeContainer(containerRef, 1200);

      expect(result.current.ratio).toBe(0.25);
    });

    it('stops following the pointer after the drag is cancelled', () => {
      const containerRef = makeContainerRef(2400, 600);
      const { result, handle } = renderWithHandle(containerRef);

      firePointer(handle, 'pointerdown', 0);
      firePointer(handle, 'pointermove', 120);
      firePointer(handle, 'pointercancel', 120);
      firePointer(handle, 'pointermove', 480);

      expect(result.current.ratio).toBeCloseTo(0.2);
    });

    it('disconnects the observer on unmount', () => {
      const { unmount } = renderWithHandle(makeContainerRef(2400, 600));
      unmount();

      expect(disconnect).toHaveBeenCalled();
    });
  });
});

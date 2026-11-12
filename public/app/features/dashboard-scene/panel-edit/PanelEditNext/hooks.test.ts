import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';

import { useTheme2 } from '@grafana/ui';

import { useSidebarCollapsed } from '../../sidebar/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import type { PanelEditor } from '../PanelEditor';
import { useSnappingSplitter } from '../splitter/useSnappingSplitter';
import { useScrollReflowLimit } from '../useScrollReflowLimit';

import { getDefaultSidebarWidth, usePanelEditorShell, useVizAndDataPaneLayout } from './hooks';

jest.mock('@grafana/ui', () => ({
  useTheme2: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({ config: { featureToggles: {} } }));

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

describe('getDefaultSidebarWidth', () => {
  it.each([
    [1000, 260, 'the collapse threshold when 20% would start it closed'],
    [1440, 288, '20% of a laptop window'],
    [1750, 350, '20% reaching the 350px cap'],
    [2560, 350, 'the 350px cap on large screens'],
  ])('gives a %spx window a %spx sidebar (%s)', (windowWidth, expected) => {
    expect(getDefaultSidebarWidth(windowWidth)).toBe(expected);
  });
});

describe('useVizAndDataPaneLayout', () => {
  const WIDTH_KEY = 'grafana.dashboard.query-editor-next.sidebar-width-v2';
  const LEGACY_WIDTH_KEY = 'grafana.dashboard.query-editor-next.sidebar-width';
  const COLLAPSED_KEY = 'grafana.dashboard.query-editor-next.sidebar-collapsed';

  beforeEach(() => {
    localStorage.clear();
    window.innerWidth = 1920;
    // Recorded calls are inspected below, so they must not carry over between cases.
    jest.clearAllMocks();
    jest.mocked(getDashboardSceneFor).mockReturnValue({ useState: jest.fn(() => ({})) } as never);
    jest.mocked(useScrollReflowLimit).mockReturnValue(false);
    jest.mocked(useSnappingSplitter).mockReturnValue(mockSplitter());
  });

  function mockSplitter(overrides: Record<string, unknown> = {}) {
    return {
      splitterState: { collapsed: false },
      splitterProps: {},
      ...overrides,
    } as never;
  }

  function makeModel() {
    return {
      useState: jest.fn(() => ({ dataPane: undefined, tableView: undefined })),
      getPanel: jest.fn(),
    } as unknown as PanelEditor;
  }

  // The sidebar splitter is the pixel-pinned one; the viz/data splitter uses a flex ratio.
  function sidebarOptionCalls() {
    return jest.mocked(useSnappingSplitter).mock.calls.filter(([options]) => options.pixelPane === 'primary');
  }

  function lastSidebarOptions() {
    return sidebarOptionCalls().at(-1)?.[0];
  }

  // The first call: the collapse write-back effect re-renders with the mocked splitter's state.
  function renderLayout() {
    renderHook(() => useVizAndDataPaneLayout(makeModel()));
    return sidebarOptionCalls()[0]?.[0];
  }

  it('uses the persisted sidebar width when it is a usable number', () => {
    localStorage.setItem(WIDTH_KEY, '480');

    expect(renderLayout()?.initialSize).toBe(480);
  });

  // The Mini/Full toggle remounts the viz/data splitter, and useSplitter keeps a flex ratio only on
  // the DOM node. The hook has to hold it so the toggle doesn't reset the split to its default.
  it('feeds the settled viz/data ratio back as the splitter initial size', () => {
    const model = {
      useState: jest.fn(() => ({ dataPane: undefined, tableView: undefined })),
      getPanel: jest.fn(),
    } as unknown as PanelEditor;

    const { rerender } = renderHook(() => useVizAndDataPaneLayout(model));

    const flexCalls = () =>
      jest.mocked(useSnappingSplitter).mock.calls.filter(([options]) => options.pixelPane === undefined);

    expect(flexCalls().at(-1)?.[0].initialSize).toBe(0.45);

    // Settle a drag that leaves the viz taking 80% of the height.
    act(() => {
      flexCalls().at(-1)?.[0].onPaneSizeChanged?.(200, 0.8);
    });
    rerender();

    expect(flexCalls().at(-1)?.[0].initialSize).toBe(0.8);
  });

  // A value of the wrong shape would render as an invalid flex-basis and collapse the sidebar to
  // the width of its drag handle, so it has to fall back to the default instead.
  it.each([
    ['null', 'null'],
    ['a boolean', 'true'],
    ['an object', '{}'],
    ['a negative number', '-5'],
    ['zero', '0'],
    ['a value that overflows to Infinity', '1e999'],
    ['a string', '"480"'],
    ['unparseable text', 'not-json'],
  ])('falls back to the default width when the persisted value is %s', (_label, stored) => {
    localStorage.setItem(WIDTH_KEY, stored);

    expect(renderLayout()?.initialSize).toBe(350);
  });

  it('sizes the sidebar to the window without persisting it until the user drags', () => {
    window.innerWidth = 1440;

    const options = renderLayout();

    expect(options?.initialSize).toBe(288);
    expect(options?.resetSize).toBe(288);
    expect(localStorage.getItem(WIDTH_KEY)).toBeNull();

    act(() => options?.onPaneSizeChanged?.(400, 0.3));

    expect(localStorage.getItem(WIDTH_KEY)).toBe('400');
  });

  it('ignores the width the previous default wrote under the legacy key', () => {
    window.innerWidth = 1440;
    localStorage.setItem(LEGACY_WIDTH_KEY, '350');

    expect(renderLayout()?.initialSize).toBe(288);
  });

  it('follows the window again after a double-click reset, even when the reset lands below the default', () => {
    localStorage.setItem(WIDTH_KEY, '400');
    // Like useSplitter, the reset reports its settled size, here capped by the data pane reserve.
    jest
      .mocked(useSnappingSplitter)
      .mockImplementation((options) =>
        mockSplitter({ splitterProps: { onDoubleClick: () => options.onPaneSizeChanged?.(270, 0.3) } })
      );

    const { result } = renderHook(() => useVizAndDataPaneLayout(makeModel()));
    act(() => result.current.sidebarSplitter.splitterProps.onDoubleClick?.());

    expect(localStorage.getItem(WIDTH_KEY)).toBeNull();
  });

  it('follows a window resize while no width is saved', async () => {
    window.innerWidth = 1440;
    renderHook(() => useVizAndDataPaneLayout(makeModel()));
    expect(lastSidebarOptions()?.initialSize).toBe(288);

    act(() => {
      window.innerWidth = 1500;
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => expect(lastSidebarOptions()?.initialSize).toBe(300));
  });

  describe('pointer interaction with the sidebar handle', () => {
    // Like useSplitter, pointer-up reports the sidebar's width whether or not the pointer moved.
    function renderWithHandle(reportedWidth: number) {
      window.innerWidth = 1440;
      jest.mocked(useSnappingSplitter).mockImplementation((options) =>
        mockSplitter({
          splitterProps: {
            onPointerDown: jest.fn(),
            onPointerUp: () => options.onPaneSizeChanged?.(reportedWidth, 0.3),
          },
        })
      );
      const { result } = renderHook(() => useVizAndDataPaneLayout(makeModel()));

      const pointer = (clientX: number) => ({ clientX }) as React.PointerEvent<HTMLDivElement>;
      const press = (downX: number, upX: number) => {
        act(() => result.current.sidebarSplitter.splitterProps.onPointerDown?.(pointer(downX)));
        act(() => result.current.sidebarSplitter.splitterProps.onPointerUp?.(pointer(upX)));
      };
      return { press };
    }

    it('does not save the width after a click without a drag', () => {
      renderWithHandle(288).press(100, 100);

      expect(localStorage.getItem(WIDTH_KEY)).toBeNull();
    });

    it('keeps a previously saved width after a click', () => {
      localStorage.setItem(WIDTH_KEY, '400');

      // A narrow window can cap the saved 400px, so the click reports a smaller width.
      renderWithHandle(288).press(100, 100);

      expect(localStorage.getItem(WIDTH_KEY)).toBe('400');
    });

    it('treats a pen or touch tap that moves slightly as a click', () => {
      renderWithHandle(290).press(100, 102);

      expect(localStorage.getItem(WIDTH_KEY)).toBeNull();
    });

    it('saves the width after a drag', () => {
      renderWithHandle(320).press(100, 132);

      expect(localStorage.getItem(WIDTH_KEY)).toBe('320');
    });

    it('still saves an arrow-key resize after a click', () => {
      renderWithHandle(288).press(100, 100);

      // Arrow keys report through the same callback without any pointer events.
      act(() => lastSidebarOptions()?.onPaneSizeChanged?.(300, 0.3));

      expect(localStorage.getItem(WIDTH_KEY)).toBe('300');
    });
  });

  // None of the splitter's own state survives a reload, so collapse has to round-trip through local
  // storage the way the width and the Mini/Full mode already do.
  describe('sidebar collapse persistence', () => {
    it('starts the sidebar collapsed when that is what was persisted', () => {
      localStorage.setItem(COLLAPSED_KEY, 'true');

      expect(renderLayout()?.collapsed).toBe(true);
    });

    it('starts the sidebar open when nothing was persisted', () => {
      expect(renderLayout()?.collapsed).toBe(false);
    });

    it('writes the collapse back so the next load picks it up', () => {
      jest.mocked(useSnappingSplitter).mockReturnValue(mockSplitter({ splitterState: { collapsed: true } }));

      renderLayout();

      expect(localStorage.getItem(COLLAPSED_KEY)).toBe('true');
    });

    // Mirrors the width hardening: valid JSON of the wrong shape must not hide the sidebar.
    it.each([
      ['an object', '{}'],
      ['a string', '"yes"'],
      ['a number', '1'],
      ['unparseable text', 'not-json'],
    ])('stays open when the persisted value is %s', (_label, stored) => {
      localStorage.setItem(COLLAPSED_KEY, stored);

      expect(renderLayout()?.collapsed).toBe(false);
    });
  });

  // Disabling a splitter strips its flex container, and only the viz/data stack has a layout to fall
  // back on. Disabling the sidebar too would drop it above the data pane instead of beside it.
  describe('on a screen short enough to reflow', () => {
    beforeEach(() => {
      jest.mocked(useScrollReflowLimit).mockReturnValue(true);
    });

    it('disables the viz/data splitter', () => {
      renderLayout();

      const flexOptions = jest.mocked(useSnappingSplitter).mock.calls.find(([options]) => !options.usePixels)?.[0];
      expect(flexOptions?.disabled).toBe(true);
    });

    it('leaves the sidebar splitter enabled', () => {
      expect(renderLayout()?.disabled).toBeFalsy();
    });
  });
});

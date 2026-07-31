import { act, renderHook } from '@testing-library/react';

import { useTheme2 } from '@grafana/ui';

import { useSidebarCollapsed } from '../../sidebar/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import type { PanelEditor } from '../PanelEditor';
import { useSnappingSplitter } from '../splitter/useSnappingSplitter';
import { useScrollReflowLimit } from '../useScrollReflowLimit';

import { usePanelEditorShell, useVizAndDataPaneLayout } from './hooks';

jest.mock('@grafana/ui', () => ({
  useTheme2: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({ config: { featureToggles: {} } }));

// Prevent heavy transitive imports (@grafana/scenes, @grafana/runtime) from loading.
jest.mock('./constants', () => ({
  SidebarSize: { Mini: 'mini', Full: 'full' },
  QUERY_EDITOR_SIDEBAR_SIZE_KEY: 'grafana.dashboard.query-editor-next.sidebar-size',
  QUERY_EDITOR_BANNER_DISMISSED_KEY: 'grafana.dashboard.query-editor-next.banner-dismissed',
  QUERY_EDITOR_SIDEBAR_WIDTH_KEY: 'grafana.dashboard.query-editor-next.sidebar-width',
  DEFAULT_SIDEBAR_WIDTH: 350,
  SIDEBAR_COLLAPSE_BELOW_PIXELS: 260,
  DATA_PANE_COLLAPSE_BELOW_PIXELS: 150,
  DEFAULT_VIZ_RATIO: 0.5,
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

describe('useVizAndDataPaneLayout', () => {
  const WIDTH_KEY = 'grafana.dashboard.query-editor-next.sidebar-width';

  beforeEach(() => {
    localStorage.clear();
    // Recorded calls are inspected below, so they must not carry over between cases.
    jest.clearAllMocks();
    jest.mocked(getDashboardSceneFor).mockReturnValue({ useState: jest.fn(() => ({})) } as never);
    jest.mocked(useScrollReflowLimit).mockReturnValue(false);
    jest.mocked(useSnappingSplitter).mockReturnValue({ splitterState: { collapsed: false } } as never);
  });

  function renderLayout() {
    const model = {
      useState: jest.fn(() => ({ dataPane: undefined, tableView: undefined })),
      getPanel: jest.fn(),
    } as unknown as PanelEditor;

    renderHook(() => useVizAndDataPaneLayout(model));

    // The sidebar splitter is the pixel-pinned one; the viz/data splitter uses a flex ratio.
    return jest.mocked(useSnappingSplitter).mock.calls.find(([options]) => options.pixelPane === 'primary')?.[0];
  }

  it('uses the persisted sidebar width when it is a usable number', () => {
    localStorage.setItem(WIDTH_KEY, '480');

    expect(renderLayout()?.initialSize).toBe(480);
  });

  // The Mini/Full toggle remounts the viz/data splitter, and useSplitter keeps a flex ratio only on
  // the DOM node. The hook has to hold it so the toggle doesn't reset the split to 50/50.
  it('feeds the settled viz/data ratio back as the splitter initial size', () => {
    const model = {
      useState: jest.fn(() => ({ dataPane: undefined, tableView: undefined })),
      getPanel: jest.fn(),
    } as unknown as PanelEditor;

    const { rerender } = renderHook(() => useVizAndDataPaneLayout(model));

    const flexCalls = () =>
      jest.mocked(useSnappingSplitter).mock.calls.filter(([options]) => options.pixelPane === undefined);

    expect(flexCalls().at(-1)?.[0].initialSize).toBe(0.5);

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

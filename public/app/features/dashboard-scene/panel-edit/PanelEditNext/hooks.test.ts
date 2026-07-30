import { renderHook } from '@testing-library/react';

import { useTheme2 } from '@grafana/ui';

import { useSidebarCollapsed } from '../../sidebar/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import type { PanelEditor } from '../PanelEditor';
import { useSnappingSplitter } from '../splitter/useSnappingSplitter';
import { useScrollReflowLimit } from '../useScrollReflowLimit';

import { usePanelEditorShell } from './hooks';

jest.mock('@grafana/ui', () => ({
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

import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useCallback, useEffect } from 'react';
import { useLocalStorage } from 'react-use';

import { useTheme2 } from '@grafana/ui';
import { MIN_SUGGESTIONS_PANE_WIDTH } from 'app/features/panel/suggestions/constants';

import { useEditPaneCollapsed } from '../../edit-pane/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import { type PanelEditor } from '../PanelEditor';
import { useSnappingSplitter } from '../splitter/useSnappingSplitter';
import { useScrollReflowLimit } from '../useScrollReflowLimit';

import {
  DATA_PANE_COLLAPSE_BELOW_PIXELS,
  DEFAULT_SIDEBAR_WIDTH,
  QUERY_EDITOR_BANNER_DISMISSED_KEY,
  QUERY_EDITOR_SIDEBAR_SIZE_KEY,
  QUERY_EDITOR_SIDEBAR_WIDTH_KEY,
  SIDEBAR_COLLAPSE_BELOW_PIXELS,
  SidebarSize,
} from './constants';

export function useQueryEditorBanner() {
  const [dismissed = false, setDismissed] = useLocalStorage(QUERY_EDITOR_BANNER_DISMISSED_KEY, false);
  const isQueryEditorNextEnabled = useBooleanFlagValue('queryEditorNext', false);
  const showBanner = isQueryEditorNextEnabled && !dismissed;
  const dismissBanner = useCallback(() => setDismissed(true), [setDismissed]);

  return { showBanner, dismissBanner };
}

export function usePanelEditorShell(model: PanelEditor) {
  const dashboard = getDashboardSceneFor(model);
  const { optionsPane } = model.useState();
  const [isInitiallyCollapsed, setIsCollapsed] = useEditPaneCollapsed();
  const isScrollingLayout = useScrollReflowLimit();
  const theme = useTheme2();
  const panePadding = parseFloat(theme.spacing(2));

  const splitter = useSnappingSplitter({
    direction: 'row',
    dragPosition: 'end',
    initialSize: 330,
    usePixels: true,
    collapsed: isInitiallyCollapsed,
    collapseBelowPixels: MIN_SUGGESTIONS_PANE_WIDTH + panePadding,
    disabled: isScrollingLayout,
  });

  useEffect(() => {
    setIsCollapsed(splitter.splitterState.collapsed);
  }, [splitter.splitterState.collapsed, setIsCollapsed]);

  return {
    dashboard,
    optionsPane,
    isScrollingLayout,
    splitter,
  };
}

/**
 * The two snapping splitters that drive the query editor v2 layout:
 *  - `vizDataSplitter` (vertical, flex): viz on top, query/data below; bottom snaps fully closed.
 *  - `sidebarSplitter` (horizontal, primary-pixel): sidebar with a persisted absolute width that
 *    snaps fully closed.
 *
 * Both hooks are called unconditionally so their state survives the Mini/Full toggle, which nests
 * them in opposite order (see `VizAndDataPaneNext`).
 */
export function useVizAndDataPaneLayout(model: PanelEditor) {
  const dashboard = getDashboardSceneFor(model);
  const { dataPane, tableView } = model.useState();
  const { controls } = dashboard.useState();

  const [sidebarSize = SidebarSize.Mini, setSidebarSize] = useLocalStorage<SidebarSize>(
    QUERY_EDITOR_SIDEBAR_SIZE_KEY,
    SidebarSize.Mini
  );
  const [sidebarWidth = DEFAULT_SIDEBAR_WIDTH, setSidebarWidth] = useLocalStorage<number>(
    QUERY_EDITOR_SIDEBAR_WIDTH_KEY,
    DEFAULT_SIDEBAR_WIDTH
  );

  const isScrollingLayout = useScrollReflowLimit();

  const vizDataSplitter = useSnappingSplitter({
    direction: 'column',
    dragPosition: 'start',
    initialSize: 0.5,
    collapseBelowPixels: DATA_PANE_COLLAPSE_BELOW_PIXELS,
    disabled: isScrollingLayout,
  });

  const sidebarSplitter = useSnappingSplitter({
    direction: 'row',
    // The sidebar is the primary (left) pane, so the handle indicator sits on its right border.
    dragPosition: 'start',
    usePixels: true,
    pixelPane: 'primary',
    initialSize: sidebarWidth,
    collapseBelowPixels: SIDEBAR_COLLAPSE_BELOW_PIXELS,
    disabled: isScrollingLayout,
    onPaneSizeChanged: setSidebarWidth,
  });

  return {
    scene: {
      dataPane,
      panel: model.getPanel(),
      tableView,
      controls,
      dashboard,
    },
    sidebarSize,
    setSidebarSize,
    isScrollingLayout,
    vizDataSplitter,
    sidebarSplitter,
  };
}

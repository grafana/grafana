import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from 'react-use';

import { useTheme2 } from '@grafana/ui';
import { MIN_SUGGESTIONS_PANE_WIDTH } from 'app/features/panel/suggestions/constants';

import { useSidebarCollapsed } from '../../sidebar/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import { type PanelEditor } from '../PanelEditor';
import { useSnappingSplitter } from '../splitter/useSnappingSplitter';
import { useScrollReflowLimit } from '../useScrollReflowLimit';

import {
  DATA_PANE_COLLAPSE_BELOW_PIXELS,
  DEFAULT_SIDEBAR_WIDTH,
  DEFAULT_VIZ_RATIO,
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
  // Subscribe to controls so the controls row appears/updates if it's set after mount.
  const { controls } = dashboard.useState();
  const [isInitiallyCollapsed, setIsCollapsed] = useSidebarCollapsed();
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
    controls,
  };
}

/**
 * The two snapping splitters that drive the query editor v2 layout:
 *  - `vizDataSplitter` (vertical, flex): viz on top, query/data below; bottom snaps fully closed.
 *  - `sidebarSplitter` (horizontal, primary-pixel): sidebar with a persisted absolute width that
 *    snaps fully closed.
 *
 * Both hooks are called unconditionally so their React state survives the Mini/Full toggle, which
 * nests them in opposite order (see `VizAndDataPaneNext`). Pane *sizes* need more than that: the
 * toggle remounts the splitter DOM, so each size is held outside it — the sidebar width in local
 * storage, the viz/data ratio in `vizRatio` below.
 */
export function useVizAndDataPaneLayout(model: PanelEditor) {
  const dashboard = getDashboardSceneFor(model);
  const { dataPane, tableView } = model.useState();
  const [sidebarSize = SidebarSize.Mini, setSidebarSize] = useLocalStorage<SidebarSize>(
    QUERY_EDITOR_SIDEBAR_SIZE_KEY,
    SidebarSize.Mini
  );
  const [storedSidebarWidth, setSidebarWidth] = useLocalStorage<number>(
    QUERY_EDITOR_SIDEBAR_WIDTH_KEY,
    DEFAULT_SIDEBAR_WIDTH
  );
  // Anything other than a positive number yields an invalid flex-basis, which drops out and leaves
  // the sidebar the width of its drag handle with the content clipped. Values that fail to parse
  // already fall back to the default, but valid JSON of the wrong shape (null, {}, -5) does not.
  const sidebarWidth =
    typeof storedSidebarWidth === 'number' && Number.isFinite(storedSidebarWidth) && storedSidebarWidth > 0
      ? storedSidebarWidth
      : DEFAULT_SIDEBAR_WIDTH;

  const isScrollingLayout = useScrollReflowLimit();

  // `useSplitter` keeps a flex-sized pane's ratio on the DOM node only. Mini and Full nest the two
  // splitters in opposite orders, so switching remounts this one — holding the ratio here (this hook
  // is not remounted by the toggle) is what carries it across.
  const [vizRatio, setVizRatio] = useState(DEFAULT_VIZ_RATIO);

  // Disabled on short screens: the viz is pinned to 100vh there and the panes stack so the editor
  // scrolls, which a flex ratio splitting a fixed height cannot express.
  const vizDataSplitter = useSnappingSplitter({
    direction: 'column',
    dragPosition: 'start',
    initialSize: vizRatio,
    collapseBelowPixels: DATA_PANE_COLLAPSE_BELOW_PIXELS,
    disabled: isScrollingLayout,
    onPaneSizeChanged: (_sizePixels, flexSize) => setVizRatio(flexSize),
  });

  // Stays enabled on short screens, unlike the splitter above. Disabling strips the flex container,
  // and the sidebar has no CSS fallback to stack against — it would land above the data pane instead
  // of beside it. A fixed pixel width beside a filling pane is the arrangement those screens want
  // anyway, so there is nothing to disable.
  const sidebarSplitter = useSnappingSplitter({
    direction: 'row',
    // The sidebar is the primary (left) pane, so the handle indicator sits on its right border.
    dragPosition: 'start',
    usePixels: true,
    pixelPane: 'primary',
    initialSize: sidebarWidth,
    collapseBelowPixels: SIDEBAR_COLLAPSE_BELOW_PIXELS,
    onPaneSizeChanged: setSidebarWidth,
  });

  return {
    scene: {
      dataPane,
      panel: model.getPanel(),
      tableView,
      dashboard,
    },
    sidebarSize,
    setSidebarSize,
    isScrollingLayout,
    vizDataSplitter,
    sidebarSplitter,
  };
}

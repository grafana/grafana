import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage, useMeasure } from 'react-use';

import { getDragStyles, useStyles2, useTheme2 } from '@grafana/ui';
import { MIN_SUGGESTIONS_PANE_WIDTH } from 'app/features/panel/suggestions/constants';

import { useEditPaneCollapsed } from '../../edit-pane/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import { PanelEditor } from '../PanelEditor';
import { useSnappingSplitter } from '../splitter/useSnappingSplitter';
import { useScrollReflowLimit } from '../useScrollReflowLimit';

import { QUERY_EDITOR_SIDEBAR_SIZE_KEY, SidebarSize } from './constants';

type UseHorizontalRatioResizeOptions = {
  getDefaultRatio: (containerWidth: number) => number;
  containerWidth: number;
  minRatio?: number;
  maxRatio?: number;
  className?: string;
};

export function useHorizontalRatioResize({
  getDefaultRatio,
  containerWidth,
  minRatio = 0,
  maxRatio = 1,
  className,
}: UseHorizontalRatioResizeOptions) {
  // null = user hasn't manually dragged, so the ratio tracks the container width automatically.
  // Once the user drags, their chosen value is locked in.
  const [userRatio, setUserRatio] = useState<number | null>(null);
  const ratio = userRatio ?? getDefaultRatio(containerWidth);

  const styles = useStyles2(getDragStyles, 'middle');

  const ratioRef = useRef(ratio);
  const containerWidthRef = useRef(containerWidth);
  const minRatioRef = useRef(minRatio);
  const maxRatioRef = useRef(maxRatio);

  ratioRef.current = ratio;
  containerWidthRef.current = containerWidth;
  minRatioRef.current = minRatio;
  maxRatioRef.current = maxRatio;

  const handleRef = useCallback((handle: HTMLElement | null) => {
    let startX = 0;
    let startRatio = 0;
    let totalWidth = 0;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaRatio = deltaX / totalWidth;
      const newRatio = Math.min(maxRatioRef.current, Math.max(minRatioRef.current, startRatio + deltaRatio));
      setUserRatio(newRatio);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      startX = e.clientX;
      startRatio = ratioRef.current;
      totalWidth = containerWidthRef.current;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    if (handle?.nodeType === Node.ELEMENT_NODE) {
      handle.addEventListener('mousedown', onMouseDown);
    }

    return () => {
      if (handle?.nodeType === Node.ELEMENT_NODE) {
        handle.removeEventListener('mousedown', onMouseDown);
      }
    };
  }, []);

  const setRatio = setUserRatio;

  return { handleRef, ratio, setRatio, className: cx(styles.dragHandleVertical, className) };
}

type UseVerticalRatioResizeOptions = {
  initialRatio: number;
  containerHeight: number;
  minRatio?: number;
  maxRatio?: number;
  className?: string;
};

export function useVerticalRatioResize({
  initialRatio,
  containerHeight,
  minRatio = 0,
  maxRatio = 1,
  className,
}: UseVerticalRatioResizeOptions) {
  const [ratio, setRatio] = useState<number>(initialRatio);
  const styles = useStyles2(getDragStyles, 'middle');

  const ratioRef = useRef(ratio);
  const containerHeightRef = useRef(containerHeight);
  const minRatioRef = useRef(minRatio);
  const maxRatioRef = useRef(maxRatio);

  ratioRef.current = ratio;
  containerHeightRef.current = containerHeight;
  minRatioRef.current = minRatio;
  maxRatioRef.current = maxRatio;

  const handleRef = useCallback((handle: HTMLElement | null) => {
    let startY = 0;
    let startRatio = 0;
    let totalHeight = 0;

    const onMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const deltaRatio = deltaY / totalHeight;
      const newRatio = Math.min(maxRatioRef.current, Math.max(minRatioRef.current, startRatio + deltaRatio));
      setRatio(newRatio);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      startY = e.clientY;
      startRatio = ratioRef.current;
      totalHeight = containerHeightRef.current;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    if (handle?.nodeType === Node.ELEMENT_NODE) {
      handle.addEventListener('mousedown', onMouseDown);
    }

    return () => {
      if (handle?.nodeType === Node.ELEMENT_NODE) {
        handle.removeEventListener('mousedown', onMouseDown);
      }
    };
  }, []);

  return { handleRef, ratio, setRatio, className: cx(styles.dragHandleHorizontal, className) };
}

export function usePanelEditorShell(model: PanelEditor) {
  const dashboard = getDashboardSceneFor(model);
  const { optionsPane } = model.useState();
  const [isInitiallyCollapsed, setIsCollapsed] = useEditPaneCollapsed();
  const isScrollingLayout = useScrollReflowLimit();
  const theme = useTheme2();
  const panePadding = +theme.spacing(2).replace(/px$/, '');

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

  const [containerRef, { height: measuredHeight, width: measuredWidth }] = useMeasure<HTMLDivElement>();
  const containerHeight = Math.max(measuredHeight, 500);
  const containerWidth = Math.max(measuredWidth, 800);

  return {
    dashboard,
    optionsPane,
    isScrollingLayout,
    containerRef,
    containerHeight,
    containerWidth,
    splitter,
  };
}

/**
 * Returns a default sidebar ratio based on the full panel editor container width
 * (which includes both the viz/data area and the options pane).
 * This is reactive — it re-evaluates on window/container resize, but is overridden
 * once the user manually drags the handle.
 *
 * Breakpoints (containerWidth ≈ window width minus Grafana nav sidebar):
 *   >= 2200px  → large monitor full-screen (e.g. 27" 4K)   → 0.15
 *   >= 1800px  → medium-large (e.g. 24" FHD full-screen)   → 0.20
 *   below      → 16" laptop or smaller / partial window     → 0.25
 */
function getDefaultSidebarRatio(containerWidth: number): number {
  if (containerWidth >= 2200) {
    return 0.15;
  }
  if (containerWidth >= 1800) {
    return 0.2;
  }
  return 0.25;
}

export function useVizAndDataPaneLayout(model: PanelEditor, containerHeight: number, containerWidth: number) {
  const CONTROLS_ROW_HEIGHT = 'auto';
  const SIDEBAR_EXPANDED_PADDING = 16;
  const COLLAPSE_BELOW_PX = 150;
  const MIN_VIZ_RATIO = 0;
  const MAX_VIZ_RATIO = 1;
  const MIN_SIDEBAR_RATIO = 0.1; // Minimum 10% for sidebar
  const MAX_SIDEBAR_RATIO = 0.5; // Maximum 50% for sidebar

  const dashboard = getDashboardSceneFor(model);
  const { dataPane, tableView } = model.useState();
  const panel = model.getPanel();
  const { controls } = dashboard.useState();
  const [sidebarSize = SidebarSize.Mini, setSidebarSize] = useLocalStorage<SidebarSize>(
    QUERY_EDITOR_SIDEBAR_SIZE_KEY,
    SidebarSize.Mini
  );

  const isScrollingLayout = useScrollReflowLimit();

  const { splitterState, onToggleCollapse } = useSnappingSplitter({
    direction: 'column',
    dragPosition: 'start',
    initialSize: 0.5,
    collapseBelowPixels: COLLAPSE_BELOW_PX,
    disabled: isScrollingLayout,
  });

  const panelToShow = tableView ?? panel;

  const sidebarResize = useHorizontalRatioResize({
    getDefaultRatio: getDefaultSidebarRatio,
    containerWidth,
    minRatio: MIN_SIDEBAR_RATIO,
    maxRatio: MAX_SIDEBAR_RATIO,
  });

  const vizResize = useVerticalRatioResize({
    initialRatio: 0.5,
    containerHeight,
    minRatio: MIN_VIZ_RATIO,
    maxRatio: MAX_VIZ_RATIO,
    className: css({ height: 2, width: '100%' }),
  });

  const gridStyles = useMemo(
    () =>
      buildVizAndDataPaneGrid({
        controlsEnabled: Boolean(controls),
        hasDataPane: Boolean(dataPane),
        isSidebarFullWidth: sidebarSize === SidebarSize.Full,
        controlsRowHeight: CONTROLS_ROW_HEIGHT,
        vizRatio: vizResize.ratio,
        sidebarRatio: sidebarResize.ratio,
      }),
    [controls, dataPane, sidebarSize, vizResize.ratio, sidebarResize.ratio]
  );

  const expandedSidebarHeight = containerHeight - SIDEBAR_EXPANDED_PADDING;

  return {
    scene: {
      dataPane,
      panelToShow,
      controls,
    },
    layout: {
      sidebarSize,
      setSidebarSize,
      isScrollingLayout,
      sidebarResize,
      vizRatio: vizResize.ratio,
      setVizRatio: vizResize.setRatio,
      expandedSidebarHeight,
      vizResizeHandle: {
        ref: vizResize.handleRef,
        className: vizResize.className,
      },
    },
    actions: {
      onToggleCollapse,
    },
    grid: {
      gridStyles,
      splitterState,
    },
  };
}

type VizAndDataPaneGridInput = {
  controlsEnabled: boolean;
  hasDataPane: boolean;
  isSidebarFullWidth: boolean;
  controlsRowHeight: string;
  vizRatio: number;
  sidebarRatio: number;
};

function buildVizAndDataPaneGrid({
  controlsEnabled,
  hasDataPane,
  isSidebarFullWidth,
  controlsRowHeight,
  vizRatio,
  sidebarRatio,
}: VizAndDataPaneGridInput) {
  const rows: string[] = [];
  const grid: Array<[string, string]> = [];

  if (controlsEnabled) {
    rows.push(controlsRowHeight);
    grid.push(['controls', 'controls']);
  }

  // Use fractional units based on ratio (e.g., 0.5 = 1fr:1fr, 0.6 = 1.5fr:1fr)
  // Handle edge cases: 0 and 1 ratios
  if (vizRatio === 0) {
    // No viz, all data pane
    rows.push('0px');
  } else if (vizRatio === 1) {
    // All viz, no data pane
    rows.push('1fr');
  } else {
    const vizFr = vizRatio / (1 - vizRatio);
    rows.push(`${vizFr}fr`);
  }
  grid.push(['viz', 'viz']);

  if (hasDataPane) {
    rows.push('1fr');
    grid.push(['sidebar', 'data-pane']);
  }

  if (hasDataPane && isSidebarFullWidth) {
    for (let i = 0; i < grid.length; i++) {
      grid[i][0] = 'sidebar';
    }
  }

  // Convert sidebar ratio to fractional units
  let columns: string;
  if (sidebarRatio === 0) {
    columns = '0px 1fr';
  } else if (sidebarRatio === 1) {
    columns = '1fr 0px';
  } else {
    const sidebarFr = sidebarRatio / (1 - sidebarRatio);
    columns = `${sidebarFr}fr 1fr`;
  }

  return {
    height: '100%',
    gridTemplateAreas: '\n' + grid.map((row) => `"${row.join(' ')}"`).join('\n'),
    gridTemplateRows: rows.join(' '),
    gridTemplateColumns: columns,
  };
}

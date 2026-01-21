import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { getDragStyles, useStyles2, useTheme2 } from '@grafana/ui';
import { MIN_SUGGESTIONS_PANE_WIDTH } from 'app/features/panel/suggestions/constants';

import { useEditPaneCollapsed } from '../../edit-pane/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import { PanelEditor } from '../PanelEditor';
import { useSnappingSplitter } from '../splitter/useSnappingSplitter';
import { useScrollReflowLimit } from '../useScrollReflowLimit';

import { SidebarSize } from './QueryEditorSidebar';

type UseHorizontalResizeOptions = {
  initialWidth: number;
  minWidth?: number;
  maxWidth?: number;
};

type UseVerticalResizeOptions = {
  initialHeight: number;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
};

export function useHorizontalResize({ initialWidth, minWidth = 0, maxWidth = Infinity }: UseHorizontalResizeOptions) {
  const [width, setWidth] = useState<number>(initialWidth);
  const styles = useStyles2(getDragStyles, 'middle');

  const handleRef = useCallback(
    (handle: HTMLElement | null) => {
      let startX = 0;
      let startWidth = 0;

      const onMouseMove = (e: MouseEvent) => {
        const delta = startX - e.clientX; // dragging left increases width of right sidebar
        const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth - delta));
        setWidth(newWidth);
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = width;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      if (handle?.nodeType === Node.ELEMENT_NODE) {
        handle.addEventListener('mousedown', onMouseDown);
      }
    },
    [maxWidth, minWidth, width]
  );

  return { handleRef, width, setWidth, className: styles.dragHandleVertical };
}

export function useVerticalResize({
  initialHeight,
  minHeight = 0,
  maxHeight = Infinity,
  className,
}: UseVerticalResizeOptions) {
  const [height, setHeight] = useState<number>(initialHeight);
  const styles = useStyles2(getDragStyles, 'middle');

  const handleRef = useCallback(
    (handle: HTMLElement | null) => {
      let startY = 0;
      let startHeight = 0;

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientY - startY; // dragging down increases height
        const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight + delta));
        setHeight(newHeight);
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        startY = e.clientY;
        startHeight = height;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      if (handle?.nodeType === Node.ELEMENT_NODE) {
        handle.addEventListener('mousedown', onMouseDown);
      }
    },
    [maxHeight, minHeight, height]
  );

  return { handleRef, height, setHeight, className: cx(styles.dragHandleHorizontal, className) };
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

  const [containerRef, { height: measuredHeight }] = useMeasure<HTMLDivElement>();
  const containerHeight = Math.max(measuredHeight, 500);

  return {
    dashboard,
    optionsPane,
    isScrollingLayout,
    containerRef,
    containerHeight,
    splitter,
  };
}

export function useVizAndDataPaneLayout(model: PanelEditor, containerHeight: number) {
  const CONTROLS_ROW_HEIGHT_PX = 32;
  const SIDEBAR_MIN_WIDTH = 285;
  const SIDEBAR_MAX_WIDTH = 380;
  const VIZ_MIN_HEIGHT = 200;
  const VIZ_BOTTOM_GAP = 80;
  const SIDEBAR_EXPANDED_PADDING = 16;
  const COLLAPSE_BELOW_PX = 150;

  const dashboard = getDashboardSceneFor(model);
  const { dataPane, tableView, editPreview } = model.useState();
  const panel = model.getPanel();
  const { controls } = dashboard.useState();
  const [sidebarSize, setSidebarSize] = useState<SidebarSize>(SidebarSize.Mini);

  const isScrollingLayout = useScrollReflowLimit();

  const { splitterState, onToggleCollapse } = useSnappingSplitter({
    direction: 'column',
    dragPosition: 'start',
    initialSize: 0.5,
    collapseBelowPixels: COLLAPSE_BELOW_PX,
    disabled: isScrollingLayout,
  });

  const panelToShow = tableView ?? editPreview ?? panel;

  const sidebarResize = useHorizontalResize({
    initialWidth: SIDEBAR_MIN_WIDTH,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
  });

  const vizResizeBarClass = css({
    height: 2,
    width: '100%',
  });

  const vizResize = useVerticalResize({
    initialHeight: Math.max(containerHeight / 2, VIZ_MIN_HEIGHT),
    minHeight: VIZ_MIN_HEIGHT,
    maxHeight: containerHeight - VIZ_BOTTOM_GAP,
    className: vizResizeBarClass,
  });

  const gridStyles = useMemo(
    () =>
      buildVizAndDataPaneGrid({
        controlsEnabled: Boolean(controls),
        hasDataPane: Boolean(dataPane),
        isSidebarFullWidth: sidebarSize === SidebarSize.Full,
        controlsRowHeightPx: CONTROLS_ROW_HEIGHT_PX,
        vizHeight: vizResize.height,
        sidebarWidth: sidebarResize.width,
        containerHeight,
      }),
    [controls, dataPane, sidebarSize, vizResize.height, sidebarResize.width, containerHeight]
  );

  const bottomPaneHeight = containerHeight - vizResize.height - VIZ_BOTTOM_GAP;
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
      vizResize,
      bottomPaneHeight,
      expandedSidebarHeight,
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
  controlsRowHeightPx: number;
  vizHeight: number;
  sidebarWidth: number;
  containerHeight: number;
};

function buildVizAndDataPaneGrid({
  controlsEnabled,
  hasDataPane,
  isSidebarFullWidth,
  controlsRowHeightPx,
  vizHeight,
  sidebarWidth,
  containerHeight,
}: VizAndDataPaneGridInput) {
  const rows: string[] = [];
  const grid: Array<[string, string]> = [];

  if (controlsEnabled) {
    rows.push(`${controlsRowHeightPx}px`);
    grid.push(['controls', 'controls']);
  }

  rows.push(`${vizHeight}px`);
  grid.push(['viz', 'viz']);

  if (hasDataPane) {
    rows.push('auto');
    grid.push(['sidebar', 'data-pane']);
  }

  if (hasDataPane && isSidebarFullWidth) {
    for (let i = 0; i < grid.length; i++) {
      grid[i][0] = 'sidebar';
    }
  }

  return {
    height: containerHeight,
    maxHeight: containerHeight,
    gridTemplateAreas: '\n' + grid.map((row) => `"${row.join(' ')}"`).join('\n'),
    gridTemplateRows: rows.join(' '),
    gridTemplateColumns: `${sidebarWidth}px 1fr`,
  };
}

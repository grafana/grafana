import { css, cx } from '@emotion/css';
import { RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from 'react-use';

import { getDragStyles, useStyles2, useTheme2 } from '@grafana/ui';
import { MIN_SUGGESTIONS_PANE_WIDTH } from 'app/features/panel/suggestions/constants';

import { useEditPaneCollapsed } from '../../edit-pane/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import { PanelEditor } from '../PanelEditor';
import { useSnappingSplitter } from '../splitter/useSnappingSplitter';
import { useScrollReflowLimit } from '../useScrollReflowLimit';

import { QUERY_EDITOR_SIDEBAR_SIZE_KEY, SidebarSize } from './constants';

const CONTROLS_ROW_HEIGHT = 'auto';
const MIN_SIDEBAR_RATIO = 0.1;
const MAX_SIDEBAR_RATIO = 0.5;
const MIN_SIDEBAR_PIXELS = 220;
const vizResizerClassName = css({ height: 2, width: '100%' });
// Pre-mount placeholder — useLayoutEffect replaces this with the responsive default before the first paint.
const FALLBACK_SIDEBAR_RATIO = 0.25;

type UseRatioResizeOptions = {
  direction: 'horizontal' | 'vertical';
  initialRatio: number;
  containerRef: RefObject<HTMLElement>;
  /**
   * If provided, called once at mount with the container's measured size to compute a
   * responsive initial ratio (e.g. different defaults for small vs large screens).
   * Runs in useLayoutEffect so there is no visible flash before the first paint.
   */
  getDefaultRatio?: (containerSize: number) => number;
  minRatio?: number;
  maxRatio?: number;
  className?: string;
};

export function useRatioResize({
  direction,
  initialRatio,
  containerRef,
  getDefaultRatio,
  minRatio = 0,
  maxRatio = 1,
  className,
}: UseRatioResizeOptions) {
  const [ratio, setRatio] = useState(initialRatio);
  const styles = useStyles2(getDragStyles, 'middle');

  const ratioRef = useRef(ratio);
  const minRatioRef = useRef(minRatio);
  const maxRatioRef = useRef(maxRatio);

  ratioRef.current = ratio;
  minRatioRef.current = minRatio;
  maxRatioRef.current = maxRatio;

  // Override the initial ratio once with a responsive value read from the DOM.
  // All three deps are stable for the lifetime of the hook, so this runs exactly once.
  useLayoutEffect(() => {
    if (!getDefaultRatio) {
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    const size = direction === 'horizontal' ? (rect?.width ?? 0) : (rect?.height ?? 0);
    if (size > 0) {
      setRatio(getDefaultRatio(size));
    }
  }, [containerRef, direction, getDefaultRatio]);

  const handleRef = useCallback(
    (handle: HTMLElement | null) => {
      let startPos = 0;
      let startRatio = 0;
      let totalSize = 0;

      const onPointerMove = (e: PointerEvent) => {
        const delta = (direction === 'horizontal' ? e.clientX : e.clientY) - startPos;
        const newRatio = Math.min(maxRatioRef.current, Math.max(minRatioRef.current, startRatio + delta / totalSize));
        setRatio(newRatio);
      };

      const onPointerUp = (e: PointerEvent) => {
        handle?.releasePointerCapture(e.pointerId);
        handle?.removeEventListener('pointermove', onPointerMove);
        handle?.removeEventListener('pointerup', onPointerUp);
      };

      const onPointerDown = (e: PointerEvent) => {
        e.preventDefault();
        startPos = direction === 'horizontal' ? e.clientX : e.clientY;
        startRatio = ratioRef.current;
        // Read exact dimensions at the moment of interaction — no continuous measurement needed.
        const rect = containerRef.current?.getBoundingClientRect();
        totalSize = direction === 'horizontal' ? (rect?.width ?? 0) : (rect?.height ?? 0);
        // Pointer capture keeps move/up events on this element regardless of where the pointer travels.
        handle?.setPointerCapture(e.pointerId);
        handle?.addEventListener('pointermove', onPointerMove);
        handle?.addEventListener('pointerup', onPointerUp);
      };

      if (handle) {
        handle.addEventListener('pointerdown', onPointerDown);
      }

      return () => {
        if (handle) {
          handle.removeEventListener('pointerdown', onPointerDown);
        }
      };
    },
    [containerRef, direction]
  );

  // dragHandleVertical = a vertical bar the user drags horizontally (col-resize cursor)
  // dragHandleHorizontal = a horizontal bar the user drags vertically (row-resize cursor)
  const dragClass = direction === 'horizontal' ? styles.dragHandleVertical : styles.dragHandleHorizontal;

  return { handleRef, ratio, setRatio, className: cx(dragClass, className) };
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
 * Returns an initial sidebar ratio based on the container width measured once at mount.
 * After that, only a manual drag updates the ratio.
 *
 * Breakpoints (containerWidth ≈ window width minus Grafana nav sidebar):
 *   >= 2200px  → large monitor full-screen (e.g. 27" 4K)   → 0.15
 *   >= 1800px  → medium-large (e.g. 24" FHD full-screen)   → 0.20
 *   below      → 16" laptop or smaller / partial window     → 0.25
 */
export function getDefaultSidebarRatio(containerWidth: number): number {
  if (containerWidth >= 2200) {
    return 0.15;
  }
  if (containerWidth >= 1800) {
    return 0.2;
  }
  return 0.25;
}

export function useVizAndDataPaneLayout(model: PanelEditor, containerRef: RefObject<HTMLDivElement>) {
  const dashboard = getDashboardSceneFor(model);
  const { dataPane, tableView } = model.useState();
  const panel = model.getPanel();
  const { controls } = dashboard.useState();
  const [sidebarSize = SidebarSize.Mini, setSidebarSize] = useLocalStorage<SidebarSize>(
    QUERY_EDITOR_SIDEBAR_SIZE_KEY,
    SidebarSize.Mini
  );

  const isScrollingLayout = useScrollReflowLimit();

  const [isDataPaneCollapsed, setIsDataPaneCollapsed] = useState(false);
  const onToggleCollapse = useCallback(() => setIsDataPaneCollapsed((v) => !v), []);

  const panelToShow = tableView ?? panel;

  const sidebarResize = useRatioResize({
    direction: 'horizontal',
    initialRatio: FALLBACK_SIDEBAR_RATIO,
    getDefaultRatio: getDefaultSidebarRatio,
    containerRef,
    minRatio: MIN_SIDEBAR_RATIO,
    maxRatio: MAX_SIDEBAR_RATIO,
  });

  const vizResize = useRatioResize({
    direction: 'vertical',
    initialRatio: 0.55,
    containerRef,
    minRatio: 0.1,
    maxRatio: 0.9,
    className: vizResizerClassName,
  });

  const gridStyles = useMemo(
    () =>
      buildVizAndDataPaneGrid({
        controlsEnabled: Boolean(controls),
        hasDataPane: Boolean(dataPane),
        isSidebarFullWidth: sidebarSize === SidebarSize.Full,
        vizRatio: vizResize.ratio,
        sidebarRatio: sidebarResize.ratio,
      }),
    [controls, dataPane, sidebarSize, vizResize.ratio, sidebarResize.ratio]
  );

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
      isDataPaneCollapsed,
      gridStyles,
      sidebarResizeHandle: {
        ref: sidebarResize.handleRef,
        className: sidebarResize.className,
      },
      vizResizeHandle: {
        ref: vizResize.handleRef,
        className: vizResize.className,
      },
    },
    actions: {
      onToggleCollapse,
    },
  };
}

type VizAndDataPaneGridInput = {
  controlsEnabled: boolean;
  hasDataPane: boolean;
  isSidebarFullWidth: boolean;
  vizRatio: number;
  sidebarRatio: number;
};

export function buildVizAndDataPaneGrid({
  controlsEnabled,
  hasDataPane,
  isSidebarFullWidth,
  vizRatio,
  sidebarRatio,
}: VizAndDataPaneGridInput) {
  const rows: string[] = [];
  const grid: Array<[string, string]> = [];

  if (controlsEnabled) {
    rows.push(CONTROLS_ROW_HEIGHT);
    grid.push(['controls', 'controls']);
  }

  // Convert ratio to fractional units (e.g. 0.5 → 1fr:1fr, 0.6 → 1.5fr:1fr).
  // vizRatio is clamped to [0.1, 0.9] so 0 and 1 are unreachable.
  const vizFr = vizRatio / (1 - vizRatio);
  rows.push(`${vizFr}fr`);
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

  // Convert sidebar ratio to fractional units (ratio is clamped to [0.1, 0.5] so 0 and 1 are unreachable).
  // minmax() enforces the pixel floor at the CSS level so window resizes can't push the sidebar
  // below MIN_SIDEBAR_PIXELS — consistent with the same floor applied in the drag handler.
  const sidebarFr = sidebarRatio / (1 - sidebarRatio);
  const columns = `minmax(${MIN_SIDEBAR_PIXELS}px, ${sidebarFr}fr) 1fr`;

  return {
    height: '100%',
    gridTemplateAreas: grid.map((row) => `"${row.join(' ')}"`).join('\n'),
    gridTemplateRows: rows.join(' '),
    gridTemplateColumns: columns,
  };
}

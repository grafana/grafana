import { css, cx } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from 'react-use';

import { getDragStyles, useStyles2, useTheme2 } from '@grafana/ui';
import { MIN_SUGGESTIONS_PANE_WIDTH } from 'app/features/panel/suggestions/constants';

import { useSidebarCollapsed } from '../../sidebar/shared';
import { getDashboardSceneFor } from '../../utils/utils';
import { type PanelEditor } from '../PanelEditor';
import { useSnappingSplitter } from '../splitter/useSnappingSplitter';
import { useScrollReflowLimit } from '../useScrollReflowLimit';

import { QUERY_EDITOR_BANNER_DISMISSED_KEY, QUERY_EDITOR_SIDEBAR_SIZE_KEY, SidebarSize } from './constants';

const MIN_SIDEBAR_RATIO = 0.1;
const MAX_SIDEBAR_RATIO = 0.5;
const MIN_SIDEBAR_PIXELS = 200;
const MAX_DEFAULT_SIDEBAR_PIXELS = 330;
const vizResizerClassName = css({ height: 2, width: '100%' });
// Pre-mount placeholder — useLayoutEffect replaces this with the responsive default before the first paint.
const FALLBACK_SIDEBAR_RATIO = 0.25;

type UseRatioResizeOptions = {
  direction: 'horizontal' | 'vertical';
  initialRatio: number;
  containerRef: RefObject<HTMLElement | null>;
  /**
   * If provided, called with the container's measured size to compute a responsive ratio
   * (e.g. different defaults for small vs large screens). Applied at mount in useLayoutEffect
   * so there is no visible flash, then re-applied on container resize until the user drags the handle.
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
  const hasUserResizedRef = useRef(false);

  ratioRef.current = ratio;
  minRatioRef.current = minRatio;
  maxRatioRef.current = maxRatio;

  // All three deps are stable for the lifetime of the hook, so the observer is set up exactly once.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!getDefaultRatio || !container) {
      return;
    }

    const applyDefaultRatio = () => {
      if (hasUserResizedRef.current) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const size = direction === 'horizontal' ? rect.width : rect.height;
      if (size > 0) {
        setRatio(getDefaultRatio(size));
      }
    };

    applyDefaultRatio();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(applyDefaultRatio);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, direction, getDefaultRatio]);

  const handleRef = useCallback(
    (handle: HTMLElement | null) => {
      let startPos = 0;
      let startRatio = 0;
      let totalSize = 0;

      const onPointerMove = (e: PointerEvent) => {
        hasUserResizedRef.current = true;
        const delta = (direction === 'horizontal' ? e.clientX : e.clientY) - startPos;
        const newRatio = Math.min(maxRatioRef.current, Math.max(minRatioRef.current, startRatio + delta / totalSize));
        setRatio(newRatio);
      };

      const onPointerEnd = (e: PointerEvent) => {
        // After pointercancel the pointer may no longer be active, and releasing capture for it throws.
        if (handle?.hasPointerCapture(e.pointerId)) {
          handle.releasePointerCapture(e.pointerId);
        }
        handle?.removeEventListener('pointermove', onPointerMove);
        handle?.removeEventListener('pointerup', onPointerEnd);
        handle?.removeEventListener('pointercancel', onPointerEnd);
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
        handle?.addEventListener('pointerup', onPointerEnd);
        handle?.addEventListener('pointercancel', onPointerEnd);
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
    dragPosition: 'middle',
    initialSize: 330,
    handleSize: 'sm',
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
 * Returns the default sidebar ratio for the measured container width.
 * Re-applied on container resize until the user drags the sidebar handle.
 *
 * containerWidth is the window width minus the Grafana nav sidebar and the options pane.
 *   >= 1400px  → 20%, capped at MAX_DEFAULT_SIDEBAR_PIXELS (reached at 1650px)
 *   below      → 18%, floored at MIN_SIDEBAR_PIXELS
 *
 * The default is 200–330px (10% above 3300px) and never shrinks as the container grows. The bounds are
 * applied to the ratio itself, clamped to the drag range, so a drag starts from the rendered width.
 */
export function getDefaultSidebarRatio(containerWidth: number): number {
  const ratio = containerWidth >= 1400 ? 0.2 : 0.18;
  const cappedRatio = Math.min(ratio, MAX_DEFAULT_SIDEBAR_PIXELS / containerWidth);
  const flooredRatio = Math.max(MIN_SIDEBAR_RATIO, MIN_SIDEBAR_PIXELS / containerWidth, cappedRatio);
  return Math.min(MAX_SIDEBAR_RATIO, flooredRatio);
}

export function useVizAndDataPaneLayout(
  model: PanelEditor,
  containerRef: RefObject<HTMLDivElement | null>,
  showBanner = false
) {
  const dashboard = getDashboardSceneFor(model);
  const { dataPane, tableView } = model.useState();
  const [sidebarSize = SidebarSize.Mini, setSidebarSize] = useLocalStorage<SidebarSize>(
    QUERY_EDITOR_SIDEBAR_SIZE_KEY,
    SidebarSize.Mini
  );

  const isScrollingLayout = useScrollReflowLimit();

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
        hasDataPane: Boolean(dataPane),
        isSidebarFullWidth: sidebarSize === SidebarSize.Full,
        showBanner,
        vizRatio: vizResize.ratio,
        sidebarRatio: sidebarResize.ratio,
      }),
    [dataPane, sidebarSize, showBanner, vizResize.ratio, sidebarResize.ratio]
  );

  return {
    scene: {
      dataPane,
      panel: model.getPanel(),
      tableView,
      dashboard,
    },
    layout: {
      sidebarSize,
      setSidebarSize,
      isScrollingLayout,
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
  };
}

type VizAndDataPaneGridInput = {
  hasDataPane: boolean;
  isSidebarFullWidth: boolean;
  showBanner: boolean;
  vizRatio: number;
  sidebarRatio: number;
};

export function buildVizAndDataPaneGrid({
  hasDataPane,
  isSidebarFullWidth,
  showBanner,
  vizRatio,
  sidebarRatio,
}: VizAndDataPaneGridInput) {
  const rows: string[] = [];
  const grid: Array<[string, string]> = [];

  // Convert ratio to fractional units (e.g. 0.5 → 1fr:1fr, 0.6 → 1.5fr:1fr).
  // vizRatio is clamped to [0.1, 0.9] so 0 and 1 are unreachable.
  const vizFr = vizRatio / (1 - vizRatio);
  rows.push(`${vizFr}fr`);
  grid.push(['viz', 'viz']);

  if (hasDataPane) {
    if (showBanner) {
      rows.push('auto');
      grid.push([isSidebarFullWidth ? 'sidebar' : 'version-toggle', 'version-toggle']);
    }

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

import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type ComposerSession } from './ComposerSession';

const PANEL_ROOT_SELECTOR = '[data-viz-panel-key]';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * A transparent layer over the dashboard controls and body while Composer is active. It takes every
 * pointer event, so clicks, menus, drag and resize, and links underneath never fire, while wheel events
 * still scroll the page. While a pick is pending it hit-tests the panel under the pointer.
 */
export function ComposerOverlay({ session }: { session: ComposerSession }) {
  const styles = useStyles2(getStyles);
  const { picking, paused, highlight } = useSyncExternalStore(session.subscribe, session.getOverlayState);
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{ key: string; box: Box } | null>(null);
  const [highlightBox, setHighlightBox] = useState<Box | null>(null);

  const boxFor = useCallback((element: Element): Box | null => {
    const overlay = ref.current?.getBoundingClientRect();
    if (!overlay) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    return { top: rect.top - overlay.top, left: rect.left - overlay.left, width: rect.width, height: rect.height };
  }, []);

  const panelRootAt = (x: number, y: number): HTMLElement | null => {
    for (const element of document.elementsFromPoint(x, y)) {
      if (element === ref.current || ref.current?.contains(element)) {
        continue;
      }
      const root = element.closest<HTMLElement>(PANEL_ROOT_SELECTOR);
      if (root) {
        return root;
      }
    }
    return null;
  };

  useEffect(() => {
    if (!picking) {
      setHovered(null);
      return;
    }
    // Escape cancels the pick before any other Escape handler (exit edit, close view panel) sees it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        session.completePick(null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [picking, session]);

  useLayoutEffect(() => {
    const key = highlight ? session.getPanelKey(highlight) : undefined;
    const element = key ? document.querySelector(`[data-viz-panel-key="${CSS.escape(key)}"]`) : null;
    setHighlightBox(element ? boxFor(element) : null);
  }, [highlight, session, boxFor]);

  const onPointerMove = (event: React.PointerEvent) => {
    if (!picking) {
      return;
    }
    const root = panelRootAt(event.clientX, event.clientY);
    const key = root?.getAttribute('data-viz-panel-key');
    const box = root ? boxFor(root) : null;
    setHovered(key && box ? { key, box } : null);
  };

  const onClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!picking) {
      return;
    }
    const key = panelRootAt(event.clientX, event.clientY)?.getAttribute('data-viz-panel-key');
    const pick = key ? session.resolvePanelPick(key) : null;
    if (pick) {
      session.completePick(pick);
    }
  };

  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={ref}
      className={cx(styles.overlay, picking && !paused && styles.picking)}
      data-testid="dashboard-composer-overlay"
      // Pointer-only layer: keyboard users select through the navigator (M3); Escape is handled on window.
      role="presentation"
      aria-hidden
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHovered(null)}
      onPointerDown={stop}
      onMouseDown={stop}
      onClick={onClick}
      onDoubleClick={stop}
      onContextMenu={stop}
      onDragStart={stop}
    >
      {highlightBox && <div className={cx(styles.box, styles.highlight)} style={highlightBox} />}
      {picking && hovered && <div className={cx(styles.box, styles.hover)} style={hovered.box} />}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    overlay: css({
      position: 'absolute',
      inset: 0,
      // Local to the dashboard container's stacking context: above the sticky controls, below app chrome.
      zIndex: theme.zIndex.navbarFixed,
      background: 'transparent',
      cursor: 'default',
    }),
    picking: css({
      cursor: 'crosshair',
    }),
    box: css({
      position: 'absolute',
      pointerEvents: 'none',
      borderRadius: theme.shape.radius.default,
    }),
    hover: css({
      outline: `2px solid ${theme.colors.primary.border}`,
      background: theme.colors.primary.transparent,
    }),
    highlight: css({
      outline: `2px dashed ${theme.colors.primary.main}`,
    }),
  };
}

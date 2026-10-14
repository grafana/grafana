import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { type ComposerSession } from './ComposerSession';
import { type ElementPoint } from './types';

const PANEL_ROOT_SELECTOR = '[data-viz-panel-key]';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Layout {
  highlight: Box | null;
  /** Element bounds per annotation id; an id without an entry does not resolve and is hidden. */
  items: Record<string, Box>;
}

const EMPTY_LAYOUT: Layout = { highlight: null, items: {} };

/**
 * A layer over the dashboard controls and body while Composer is active.
 *
 * The blocking layer takes every pointer event, so clicks, menus, drag and resize, and links underneath
 * never fire, while wheel events still scroll the page. While a pick is pending it hit-tests the panel
 * under the pointer. Above it sit the annotation pins and the anchors the plugin portals its editor into.
 * All positions are relative to this layer and re-measured on scroll, resize and layout changes.
 */
export function ComposerOverlay({ session }: { session: ComposerSession }) {
  const styles = useStyles2(getStyles);
  const overlayState = useSyncExternalStore(session.subscribe, session.getOverlayState);
  const { picking, paused, annotations } = overlayState;
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorHostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const [hovered, setHovered] = useState<{ key: string; box: Box } | null>(null);
  const [layout, setLayout] = useState<Layout>(EMPTY_LAYOUT);

  const boxFor = useCallback((element: Element): Box | null => {
    const root = rootRef.current?.getBoundingClientRect();
    if (!root) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    return { top: rect.top - root.top, left: rect.left - root.left, width: rect.width, height: rect.height };
  }, []);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const resolve = (element: HTMLElement | null) => (element ? boxFor(element) : null);
    const { highlight, annotations: items } = session.getOverlayState();
    const next: Layout = { highlight: highlight ? resolve(session.findElementRoot(highlight)) : null, items: {} };
    for (const item of items) {
      const box = resolve(session.findElementRoot(item.ref));
      if (box) {
        next.items[item.id] = box;
      }
    }
    const rootRect = root.getBoundingClientRect();
    session.getAnchors().forEach((anchor, id) => {
      const item = items.find((candidate) => candidate.id === id);
      const box = next.items[id];
      if (!item || !box) {
        anchor.style.display = 'none';
        return;
      }
      const { left, top } = anchorPosition(box, item.point, rootRect);
      Object.assign(anchor.style, { display: '', left: `${left}px`, top: `${top}px` });
    });
    setLayout(next);
  }, [boxFor, session]);

  const scheduleMeasure = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(measure);
  }, [measure]);

  // Measure after every session change, and again on the next frame: a spec apply re-renders the
  // dashboard after the change is announced.
  useLayoutEffect(() => {
    measure();
    scheduleMeasure();
  }, [overlayState, measure, scheduleMeasure]);

  useLayoutEffect(() => {
    session.setAnchorHost(anchorHostRef.current, scheduleMeasure);
    return () => session.setAnchorHost(null);
  }, [session, scheduleMeasure]);

  useEffect(() => {
    window.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true });
    window.addEventListener('resize', scheduleMeasure);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(scheduleMeasure);
    if (rootRef.current) {
      observer?.observe(rootRef.current);
    }
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('scroll', scheduleMeasure, { capture: true });
      window.removeEventListener('resize', scheduleMeasure);
      observer?.disconnect();
    };
  }, [scheduleMeasure]);

  const panelRootAt = (x: number, y: number): HTMLElement | null => {
    for (const element of document.elementsFromPoint(x, y)) {
      if (rootRef.current?.contains(element)) {
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
    const root = panelRootAt(event.clientX, event.clientY);
    const key = root?.getAttribute('data-viz-panel-key');
    if (!root || !key) {
      return;
    }
    const rect = root.getBoundingClientRect();
    const point = {
      x: rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0,
      y: rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0,
    };
    const pick = session.resolvePanelPick(key, point);
    if (pick) {
      session.completePick(pick);
    }
  };

  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <div
        className={cx(styles.blocker, picking && !paused && styles.picking)}
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
        {layout.highlight && <div className={cx(styles.box, styles.highlight)} style={layout.highlight} />}
        {annotations.map(({ id, state }) => {
          const box = layout.items[id];
          return state === 'active' && box ? (
            <div
              key={id}
              className={cx(styles.box, styles.active)}
              style={box}
              data-testid={`composer-annotation-outline-${id}`}
            />
          ) : null;
        })}
        {picking && hovered && <div className={cx(styles.box, styles.hover)} style={hovered.box} />}
      </div>
      {annotations.map(({ id, label, point }) => {
        const box = layout.items[id];
        if (!box) {
          return null;
        }
        return (
          <button
            key={id}
            type="button"
            className={cx(styles.pin, paused && styles.pinDisabled)}
            style={{ left: box.left + point.x * box.width, top: box.top + point.y * box.height }}
            aria-label={t('dashboard.composer.annotation-pin', 'Comment {{label}}', { label })}
            aria-disabled={paused || undefined}
            data-testid={`composer-annotation-pin-${id}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              session.activateAnnotation(id);
            }}
          >
            {label}
          </button>
        );
      })}
      <div ref={anchorHostRef} className={styles.anchorHost} />
    </div>
  );
}

/**
 * Top-centre of the part of the element inside the viewport; the pin's point, clamped to the viewport,
 * when none of the element is visible. Returned relative to the overlay.
 */
function anchorPosition(box: Box, point: ElementPoint, root: DOMRect): { left: number; top: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = root.left + box.left;
  const top = root.top + box.top;
  const visibleLeft = Math.max(left, 0);
  const visibleRight = Math.min(left + box.width, viewportWidth);
  const visibleTop = Math.max(top, 0);
  const visibleBottom = Math.min(top + box.height, viewportHeight);

  let x: number;
  let y: number;
  if (visibleLeft <= visibleRight && visibleTop <= visibleBottom) {
    x = clamp(left + box.width / 2, visibleLeft, visibleRight);
    y = visibleTop;
  } else {
    x = clamp(left + point.x * box.width, 0, viewportWidth);
    y = clamp(top + point.y * box.height, 0, viewportHeight);
  }
  return { left: x - root.left, top: y - root.top };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const PIN_SIZE = 24;

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      position: 'absolute',
      inset: 0,
      // Local to the dashboard container's stacking context: above the sticky controls, below app chrome.
      zIndex: theme.zIndex.navbarFixed,
      pointerEvents: 'none',
    }),
    blocker: css({
      position: 'absolute',
      inset: 0,
      background: 'transparent',
      cursor: 'default',
      pointerEvents: 'auto',
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
    active: css({
      outline: `2px solid ${theme.colors.primary.border}`,
    }),
    pin: css({
      position: 'absolute',
      transform: 'translate(-50%, -50%)',
      minWidth: PIN_SIZE,
      height: PIN_SIZE,
      padding: theme.spacing(0, 0.5),
      border: 'none',
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      boxShadow: theme.shadows.z2,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: `${PIN_SIZE}px`,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      pointerEvents: 'auto',
      '&:focus-visible': getFocusStyles(theme),
    }),
    pinDisabled: css({
      cursor: 'not-allowed',
    }),
    anchorHost: css({
      position: 'absolute',
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    }),
  };
}

import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { type Box, type ComposerSession } from './ComposerSession';
import { type ElementPoint } from './types';

const PANEL_ROOT_SELECTOR = '[data-viz-panel-key]';
const TAB_SELECTOR = '[role="tab"]';
/** A drawn rectangle smaller than this, in CSS pixels on either side, is ignored. */
const MIN_REGION_SIZE = 8;

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
  const { picking, pickMode, paused, capturing, annotations } = overlayState;
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorHostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const [hovered, setHovered] = useState<{ key: string; box: Box } | null>(null);
  const [layout, setLayout] = useState<Layout>(EMPTY_LAYOUT);
  /** Where a region drag started, in viewport coordinates; null when not dragging. */
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  /** A finished or ignored drag swallows the click that follows its pointer-up. */
  const swallowClickRef = useRef(false);
  const [draft, setDraft] = useState<Box | null>(null);

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
    const rootRect = root.getBoundingClientRect();
    const { highlight, annotations: items } = session.getOverlayState();
    const next: Layout = { highlight: highlight ? session.resolveBox(highlight, rootRect) : null, items: {} };
    for (const item of items) {
      const box = session.resolveBox(item.ref, rootRect);
      if (box) {
        next.items[item.id] = box;
      }
    }
    session.getAnchors().forEach((anchor, id) => {
      const item = items.find((candidate) => candidate.id === id);
      const position = item && next.items[id] ? anchorPosition(next.items[id], item.point, rootRect) : null;
      if (!position) {
        anchor.style.display = 'none';
        return;
      }
      Object.assign(anchor.style, { display: '', left: `${position.left}px`, top: `${position.top}px` });
    });
    setLayout(next);
  }, [session]);

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

  /** The closest element matching `selector` under the point, ignoring Composer's own layer. */
  const elementAt = (x: number, y: number, selector: string): HTMLElement | null => {
    for (const element of document.elementsFromPoint(x, y)) {
      if (rootRef.current?.contains(element)) {
        continue;
      }
      const match = element.closest<HTMLElement>(selector);
      if (match) {
        return match;
      }
    }
    return null;
  };

  // A cancelled drag leaves the pending pick pending.
  const cancelDrag = useCallback(() => {
    if (dragStartRef.current) {
      dragStartRef.current = null;
      swallowClickRef.current = true;
      setDraft(null);
    }
  }, []);

  useEffect(() => {
    if (!picking) {
      setHovered(null);
      cancelDrag();
      return;
    }
    // Escape cancels a drag, else the pick, before any other Escape handler (exit edit, close view panel)
    // sees it, except inside an annotation anchor: that Escape belongs to the plugin's editor.
    const onKeyDown = (event: KeyboardEvent) => {
      const fromAnchor = event.target instanceof Node && anchorHostRef.current?.contains(event.target);
      if (event.key !== 'Escape' || fromAnchor) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (dragStartRef.current) {
        cancelDrag();
      } else {
        session.completePick(null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', cancelDrag);
    window.addEventListener('scroll', cancelDrag, { capture: true, passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', cancelDrag);
      window.removeEventListener('scroll', cancelDrag, { capture: true });
    };
  }, [picking, session, cancelDrag]);

  const toDraft = (start: { x: number; y: number }, x: number, y: number): Box => ({
    left: Math.min(start.x, x),
    top: Math.min(start.y, y),
    width: Math.abs(x - start.x),
    height: Math.abs(y - start.y),
  });

  const onPointerDown = (event: React.PointerEvent) => {
    stop(event);
    swallowClickRef.current = false;
    // Shift is read at pointer-down only; the Region tool drags without it.
    if (event.button !== 0 || !picking || paused || capturing || (pickMode !== 'region' && !event.shiftKey)) {
      return;
    }
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start) {
      return;
    }
    dragStartRef.current = null;
    swallowClickRef.current = true;
    setDraft(null);
    const rect = toDraft(start, event.clientX, event.clientY);
    if (rect.width < MIN_REGION_SIZE || rect.height < MIN_REGION_SIZE) {
      return;
    }
    const pick = session.createRegionPick(rect);
    if (pick) {
      session.completePick(pick);
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (start) {
      const rootRect = rootRef.current?.getBoundingClientRect();
      const rect = toDraft(start, event.clientX, event.clientY);
      setDraft(rootRect ? { ...rect, left: rect.left - rootRect.left, top: rect.top - rootRect.top } : null);
      setHovered(null);
      return;
    }
    if (pickMode !== 'element') {
      return;
    }
    const root = elementAt(event.clientX, event.clientY, PANEL_ROOT_SELECTOR);
    const key = root?.getAttribute('data-viz-panel-key');
    const box = root ? boxFor(root) : null;
    setHovered(key && box ? { key, box } : null);
  };

  const onClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (swallowClickRef.current) {
      swallowClickRef.current = false;
      return;
    }
    // A capture renders the current tab: nothing changes under it until it settles.
    if (capturing) {
      return;
    }
    // Tab headers stay usable: switching tabs is how regions on other tabs get drawn.
    const tab = elementAt(event.clientX, event.clientY, TAB_SELECTOR);
    if (tab) {
      tab.click();
      return;
    }
    if (pickMode !== 'element') {
      return;
    }
    const root = elementAt(event.clientX, event.clientY, PANEL_ROOT_SELECTOR);
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
    <div ref={rootRef} className={styles.root} data-composer-capture-exclude>
      <div
        className={cx(styles.blocker, picking && !paused && !capturing && styles.picking)}
        data-testid="dashboard-composer-overlay"
        // Pointer-only layer: keyboard users select through the navigator (M3); Escape is handled on window.
        role="presentation"
        aria-hidden
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHovered(null)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={cancelDrag}
        onMouseDown={stop}
        onClick={onClick}
        onDoubleClick={stop}
        onContextMenu={stop}
        onDragStart={stop}
      >
        {layout.highlight && <div className={cx(styles.box, styles.highlight)} style={layout.highlight} />}
        {annotations.map(({ id, ref, state }) => {
          const box = layout.items[id];
          // Panels are outlined only while active; regions always, faint while staged.
          if (!box || (ref.kind !== 'region' && state !== 'active')) {
            return null;
          }
          const outline =
            ref.kind === 'region' ? (state === 'active' ? styles.regionActive : styles.regionStaged) : styles.active;
          return (
            <div
              key={id}
              className={cx(styles.box, outline)}
              style={box}
              data-testid={`composer-annotation-outline-${id}`}
              data-state={state}
            />
          );
        })}
        {picking && hovered && <div className={cx(styles.box, styles.hover)} style={hovered.box} />}
        {draft && <div className={cx(styles.box, styles.draft)} style={draft} data-testid="composer-region-draft" />}
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
            onPointerEnter={() => session.hoverAnnotation(id)}
            onPointerLeave={() => session.hoverAnnotation(null)}
            onFocus={() => session.hoverAnnotation(id)}
            onBlur={() => session.hoverAnnotation(null)}
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
 * The pin's centre (the element-relative point), clamped to the viewport, relative to the overlay.
 * Null when no part of the element is in the viewport.
 */
function anchorPosition(box: Box, point: ElementPoint, root: DOMRect): { left: number; top: number } | null {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = root.left + box.left;
  const top = root.top + box.top;
  if (left > viewportWidth || top > viewportHeight || left + box.width < 0 || top + box.height < 0) {
    return null;
  }
  const x = clamp(left + point.x * box.width, 0, viewportWidth);
  const y = clamp(top + point.y * box.height, 0, viewportHeight);
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
    draft: css({
      border: `2px dashed ${theme.colors.primary.main}`,
      background: theme.colors.primary.transparent,
    }),
    regionActive: css({
      border: `2px solid ${theme.colors.primary.border}`,
    }),
    regionStaged: css({
      border: `1px dashed ${theme.colors.primary.border}`,
      opacity: 0.6,
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

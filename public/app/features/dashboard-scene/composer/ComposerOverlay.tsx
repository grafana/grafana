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
  /** The overlay's own size, which pins are kept inside. */
  width: number;
  height: number;
}

const EMPTY_LAYOUT: Layout = { highlight: null, items: {}, width: 0, height: 0 };

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
  /**
   * Where a press started, in viewport coordinates, and whether it has since moved far enough to be a drag;
   * null when no press is in progress.
   */
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
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
    coverContent(root);
    const rootRect = root.getBoundingClientRect();
    const { highlight, annotations: items } = session.getOverlayState();
    const next: Layout = {
      highlight: highlight ? session.resolveBox(highlight, rootRect) : null,
      items: {},
      width: rootRect.width,
      height: rootRect.height,
    };
    for (const item of items) {
      const box = session.resolveBox(item.ref, rootRect);
      if (box) {
        next.items[item.id] = box;
      }
    }
    session.getAnchors().forEach((anchor, id) => {
      const item = items.find((candidate) => candidate.id === id);
      const box = next.items[id];
      const position = item && box ? anchorPosition(box, pinCentre(box, item.point, next), rootRect) : null;
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

  /**
   * The rectangle between the press and the pointer, in viewport coordinates, clamped to the overlay (the
   * dashboard controls and body): core cannot draw or capture outside it.
   */
  const toDraft = (start: { x: number; y: number }, x: number, y: number): Box => {
    const bounds = rootRef.current?.getBoundingClientRect();
    const clampX = (value: number) => (bounds ? clamp(value, bounds.left, bounds.left + bounds.width) : value);
    const clampY = (value: number) => (bounds ? clamp(value, bounds.top, bounds.top + bounds.height) : value);
    const [x1, x2, y1, y2] = [clampX(start.x), clampX(x), clampY(start.y), clampY(y)];
    return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    stop(event);
    swallowClickRef.current = false;
    // Any primary-button press may become a region: a click picks an element, a drag draws a region.
    if (event.button !== 0 || !picking || paused || capturing) {
      return;
    }
    // A press on a tab header is a tab switch, never the start of a region: its click passes through.
    if (elementAt(event.clientX, event.clientY, TAB_SELECTOR)) {
      return;
    }
    dragStartRef.current = { x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start) {
      return;
    }
    dragStartRef.current = null;
    setDraft(null);
    const rect = toDraft(start, event.clientX, event.clientY);
    if (!start.moved && rect.width < MIN_REGION_SIZE && rect.height < MIN_REGION_SIZE) {
      // Never moved far enough to be a drag: with Select it is a click on the element; the Region tool
      // ignores it.
      swallowClickRef.current = pickMode === 'region';
      return;
    }
    // A drag never turns back into a click; one too thin for a region is dropped and the pick stays pending.
    swallowClickRef.current = true;
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
      // A jitter during a click is not a drag yet: keep showing the element under the pointer.
      if (rect.width >= MIN_REGION_SIZE || rect.height >= MIN_REGION_SIZE) {
        start.moved = true;
      }
      if (start.moved) {
        setDraft(rootRect ? { ...rect, left: rect.left - rootRect.left, top: rect.top - rootRect.top } : null);
        setHovered(null);
        return;
      }
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
            style={pinCentre(box, point, layout)}
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
 * Stretches the overlay over everything its container lays out, including content that overflows the
 * container, so outlines and pins of regions further down are never cut short. Writes only on change, and
 * leaves the overlay itself out of the measurement so its own size never feeds back into it.
 */
function coverContent(root: HTMLElement) {
  const container = root.parentElement;
  if (!container) {
    return;
  }
  let height = 0;
  let width = 0;
  for (const child of container.children) {
    if (child === root || !(child instanceof HTMLElement)) {
      continue;
    }
    height = Math.max(height, child.offsetTop + Math.max(child.offsetHeight, child.scrollHeight));
    width = Math.max(width, child.offsetLeft + Math.max(child.offsetWidth, child.scrollWidth));
  }
  const minHeight = `${Math.ceil(height)}px`;
  const minWidth = `${Math.ceil(width)}px`;
  if (root.style.minHeight !== minHeight) {
    root.style.minHeight = minHeight;
  }
  if (root.style.minWidth !== minWidth) {
    root.style.minWidth = minWidth;
  }
}

/**
 * Where a pin is drawn, relative to the overlay: the element-relative point, kept far enough inside the
 * overlay that the whole pin shows (a pin on a region's corner at the overlay's edge would be half outside).
 */
function pinCentre(box: Box, point: ElementPoint, overlay: { width: number; height: number }) {
  const half = PIN_SIZE / 2;
  return {
    left: clamp(box.left + point.x * box.width, half, Math.max(half, overlay.width - half)),
    top: clamp(box.top + point.y * box.height, half, Math.max(half, overlay.height - half)),
  };
}

/**
 * The pin's centre, clamped to the viewport, relative to the overlay. Null when no part of the element is
 * in the viewport.
 */
function anchorPosition(
  box: Box,
  pin: { left: number; top: number },
  root: DOMRect
): { left: number; top: number } | null {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = root.left + box.left;
  const top = root.top + box.top;
  if (left > viewportWidth || top > viewportHeight || left + box.width < 0 || top + box.height < 0) {
    return null;
  }
  const x = clamp(root.left + pin.left, 0, viewportWidth);
  const y = clamp(root.top + pin.top, 0, viewportHeight);
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
      // Local to the dashboard container's stacking context, so below app chrome. The sticky dashboard
      // controls sit at `sidemenu` in the same context; anything lower lets them cover pins and outlines.
      zIndex: theme.zIndex.sidemenu + 1,
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

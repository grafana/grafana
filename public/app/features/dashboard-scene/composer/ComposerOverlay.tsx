import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { FLOATING_DRAG_HANDLE_ATTRIBUTE } from 'app/core/components/AppChrome/ExtensionSidebar/useFloatingDrag';

import { type ComposerSession } from './ComposerSession';
import { type Box, VARIABLE_CONTROL_SELECTOR } from './composerGeometry';
import { type ComposerAnnotation } from './types';

const TAB_SELECTOR = '[role="tab"]';
/** The dashboard controls (time picker, refresh, save, share, variables) stay usable in Composer. */
const CONTROLS_SELECTOR = `[data-testid="${selectors.pages.Dashboard.Controls}"]`;
/** The extension sidebar, docked or floating: never part of the document Composer annotates. */
const EXTENSION_SIDEBAR_SELECTOR = '[data-extension-sidebar]';
/** A drawn rectangle smaller than this, in CSS pixels on either side, is ignored. */
const MIN_REGION_SIZE = 8;
/** How far from the pointer the pick hint sits. */
const HINT_OFFSET = 12;
/** Pixels per line for a wheel that reports its delta in lines. */
const WHEEL_LINE_HEIGHT = 16;

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
 * never fire, while the wheel scrolls what is under the pointer. While a pick is pending it hit-tests the panel
 * under the pointer. Above it sit the annotation pins and the anchors the plugin portals its editor into.
 * All positions are relative to this layer and re-measured on scroll, resize and layout changes.
 */
export function ComposerOverlay({
  session,
  belowStickyControls = false,
}: {
  session: ComposerSession<unknown>;
  /**
   * For a document whose sticky controls sit outside the overlay (a notebook's): the layer stays under
   * them, so content scrolled beneath them never blocks the controls.
   */
  belowStickyControls?: boolean;
}) {
  const styles = useStyles2(getStyles);
  const overlayState = useSyncExternalStore(session.subscribe, session.getOverlayState);
  const { picking, pickMode, paused, capturing, annotations } = overlayState;
  const rootRef = useRef<HTMLDivElement>(null);
  const blockerRef = useRef<HTMLDivElement>(null);
  /** The pointer is over the dashboard controls, which then receive it instead of the blocking layer. */
  const overControlsRef = useRef(false);
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
  /**
   * The pick hint that follows the pointer. React state holds only which copy shows (or none); its position
   * is written to the element once per animation frame, so moving the pointer renders nothing.
   */
  const [hintCopy, setHintCopy] = useState<'element' | 'region' | null>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const hintPointerRef = useRef<{ x: number; y: number } | null>(null);
  const hintFrameRef = useRef(0);

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
      const position = item && box ? anchorPosition(box, pinCentre(box, item, next), rootRect) : null;
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
    const root = rootRef.current;
    if (root) {
      observer?.observe(root);
      // The overlay covers at least the content it measured, so a page that narrows (the extension sidebar
      // docking next to it) does not resize the overlay itself: watch the container and its content too.
      const container = root.parentElement;
      if (container) {
        observer?.observe(container);
        for (const child of container.children) {
          if (child !== root) {
            observer?.observe(child);
          }
        }
      }
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
  const toDraft = useCallback((start: { x: number; y: number }, x: number, y: number): Box => {
    const bounds = rootRef.current?.getBoundingClientRect();
    const clampX = (value: number) => (bounds ? clamp(value, bounds.left, bounds.left + bounds.width) : value);
    const clampY = (value: number) => (bounds ? clamp(value, bounds.top, bounds.top + bounds.height) : value);
    // It may run on under the extension sidebar: the content there is the document's, the draft paints below
    // the sidebar, and the capture leaves the sidebar out.
    const from = { x: clampX(start.x), y: clampY(start.y) };
    const to = { x: clampX(x), y: clampY(y) };
    return {
      left: Math.min(from.x, to.x),
      top: Math.min(from.y, to.y),
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
    };
  }, []);

  /** Shows a draft rectangle given in viewport coordinates. */
  const showDraft = useCallback((rect: Box) => {
    const rootRect = rootRef.current?.getBoundingClientRect();
    setDraft(rootRect ? { ...rect, left: rect.left - rootRect.left, top: rect.top - rootRect.top } : null);
  }, []);

  const hintAllowed = pickMode === 'element' && !paused && !capturing;

  const hideHint = useCallback(() => {
    cancelAnimationFrame(hintFrameRef.current);
    hintPointerRef.current = null;
    setHintCopy(null);
  }, []);

  // 12px down-right of the pointer, flipped left or up near the viewport's right or bottom edge.
  const positionHint = useCallback(() => {
    const element = hintRef.current;
    const pointer = hintPointerRef.current;
    const root = rootRef.current;
    if (!element || !pointer || !root) {
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const { width, height } = element.getBoundingClientRect();
    let x = pointer.x + HINT_OFFSET;
    let y = pointer.y + HINT_OFFSET;
    if (x + width > window.innerWidth) {
      x = pointer.x - HINT_OFFSET - width;
    }
    if (y + height > window.innerHeight) {
      y = pointer.y - HINT_OFFSET - height;
    }
    element.style.transform = `translate(${Math.round(x - rootRect.left)}px, ${Math.round(y - rootRect.top)}px)`;
  }, []);

  const followHint = (x: number, y: number) => {
    if (!hintAllowed || dragStartRef.current?.moved || overControlsRef.current) {
      hideHint();
      return;
    }
    hintPointerRef.current = { x, y };
    cancelAnimationFrame(hintFrameRef.current);
    hintFrameRef.current = requestAnimationFrame(() => {
      setHintCopy(elementAt(x, y, session.elementSelector) ? 'element' : 'region');
      positionHint();
    });
  };

  // Position a hint that just appeared before it paints.
  useLayoutEffect(() => positionHint(), [hintCopy, positionHint]);

  useEffect(() => {
    if (!hintAllowed) {
      hideHint();
    }
  }, [hintAllowed, hideHint]);

  useEffect(() => () => cancelAnimationFrame(hintFrameRef.current), []);

  const isOverControls = useCallback((x: number, y: number) => {
    const rect = rootRef.current?.parentElement?.querySelector(CONTROLS_SELECTOR)?.getBoundingClientRect();
    return Boolean(rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
  }, []);

  // Over the controls band the blocking layer lets the pointer through to the real controls; pins and
  // anchors drawn there sit above it and stay clickable. Tracked on the window, since the layer gets no
  // events while it is transparent to them.
  useEffect(() => {
    const blocker = blockerRef.current;
    if (!blocker) {
      return;
    }
    const onMove = (event: PointerEvent) => {
      if (dragStartRef.current) {
        return;
      }
      const over = isOverControls(event.clientX, event.clientY);
      if (over === overControlsRef.current) {
        return;
      }
      overControlsRef.current = over;
      blocker.style.pointerEvents = over ? 'none' : '';
      if (over) {
        hideHint();
        setHovered(null);
      }
    };
    window.addEventListener('pointermove', onMove, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove, { capture: true });
      blocker.style.pointerEvents = '';
      overControlsRef.current = false;
    };
  }, [isOverControls, hideHint]);

  // The blocking layer is not inside the dashboard's scroll container, so a wheel over it would scroll
  // nothing. Scroll what is under the pointer instead, as the wheel would without the layer: a scrollable
  // panel first, then the dashboard body once the panel can scroll no further that way.
  useEffect(() => {
    const blocker = blockerRef.current;
    const root = rootRef.current;
    if (!blocker || !root) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      // Ctrl+wheel and trackpad pinch zoom the page.
      if (event.ctrlKey) {
        return;
      }
      const target = findWheelTarget(root, event.clientX, event.clientY, event.deltaX, event.deltaY);
      if (!target) {
        return;
      }
      event.preventDefault();
      target.scrollBy({
        left: wheelDeltaToPixels(event.deltaX, event.deltaMode, target.clientWidth),
        top: wheelDeltaToPixels(event.deltaY, event.deltaMode, target.clientHeight),
      });
    };
    blocker.addEventListener('wheel', onWheel, { passive: false });
    return () => blocker.removeEventListener('wheel', onWheel);
  }, []);

  /** A drag that started on the controls has ended: the click it would end in must not reach a control. */
  const swallowControlsClickRef = useRef(false);

  // Presses on the controls reach them, but one that moves 8px or more becomes a region drag from the
  // press point, like a drag on the body. The controls receive the pointer here, not the blocking layer,
  // so this listens on the window, in the capture phase to get there first.
  useEffect(() => {
    if (!picking || paused || capturing) {
      return;
    }
    let press: { x: number; y: number; pointerId: number; dragged: boolean } | undefined;
    const onDown = (event: PointerEvent) => {
      const onOwnLayer = event.target instanceof Node && rootRef.current?.contains(event.target);
      press =
        event.button === 0 && !onOwnLayer && isOverControls(event.clientX, event.clientY)
          ? { x: event.clientX, y: event.clientY, pointerId: event.pointerId, dragged: false }
          : undefined;
    };
    const onMove = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.pointerId) {
        return;
      }
      if (!press.dragged) {
        if (Math.max(Math.abs(event.clientX - press.x), Math.abs(event.clientY - press.y)) < MIN_REGION_SIZE) {
          return;
        }
        press.dragged = true;
        dragStartRef.current = { x: press.x, y: press.y, moved: true };
        // Undo what the press began on the control it started on, such as focus or an open menu.
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && rootRef.current?.parentElement?.contains(focused)) {
          focused.blur();
        }
        hideHint();
        setHovered(null);
      }
      window.getSelection()?.removeAllRanges();
      if (dragStartRef.current) {
        showDraft(toDraft(press, event.clientX, event.clientY));
      }
    };
    const onUp = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.pointerId) {
        return;
      }
      const { dragged } = press;
      press = undefined;
      if (!dragged) {
        // A press that never moved 8px is the control's.
        return;
      }
      event.stopPropagation();
      swallowControlsClickRef.current = true;
      const start = dragStartRef.current;
      dragStartRef.current = null;
      setDraft(null);
      // Cancelled meanwhile (Escape, blur, scroll): nothing to draw, but the click is still swallowed.
      if (!start) {
        return;
      }
      const rect = toDraft(start, event.clientX, event.clientY);
      const pick =
        rect.width < MIN_REGION_SIZE || rect.height < MIN_REGION_SIZE ? null : session.createRegionPick(rect);
      if (pick) {
        session.completePick(pick);
      }
    };
    const onCancel = () => {
      press = undefined;
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
    };
  }, [picking, paused, capturing, isOverControls, toDraft, showDraft, hideHint, session]);

  // Outlives the pick the drag resolved, since its click arrives after the pick has ended.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (swallowControlsClickRef.current) {
        swallowControlsClickRef.current = false;
        event.preventDefault();
        // Also keeps the variable-label pick below from treating it as a click.
        event.stopImmediatePropagation();
      }
    };
    const onDown = () => {
      // A release that produced no click must not swallow a later one.
      swallowControlsClickRef.current = false;
    };
    window.addEventListener('click', onClick, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, []);

  // With Select, a click on a variable's label picks the variable; its value picker still works as usual.
  useEffect(() => {
    if (pickMode !== 'element' || paused || capturing) {
      return;
    }
    const onClick = (event: MouseEvent) => {
      const container = rootRef.current?.parentElement;
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>(VARIABLE_CONTROL_SELECTOR);
      const label = target?.closest('label');
      const key = control?.getAttribute('data-dashboard-element-key');
      if (!container?.contains(control ?? null) || !label || !control?.contains(label) || !key) {
        return;
      }
      const pick = session.resolveVariablePick(key);
      if (pick) {
        // The label would otherwise focus the value picker.
        event.preventDefault();
        event.stopImmediatePropagation();
        session.completePick(pick);
      }
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [pickMode, paused, capturing, session]);

  const onPointerDown = (event: React.PointerEvent) => {
    stop(event);
    hideHint();
    swallowClickRef.current = false;
    // Any primary-button press may become a region: a click picks an element, a drag draws a region.
    if (event.button !== 0 || !picking || paused || capturing) {
      return;
    }
    // A press on a tab header is a tab switch, never the start of a region: its click passes through.
    // A press on the controls is theirs too (it lands here only before the pointer has moved onto them).
    // So is a press inside the extension sidebar, which only reaches this layer if a host stacks it wrong.
    if (
      elementAt(event.clientX, event.clientY, TAB_SELECTOR) ||
      isOverControls(event.clientX, event.clientY) ||
      isOverExtensionSidebar(event.clientX, event.clientY)
    ) {
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
      const rect = toDraft(start, event.clientX, event.clientY);
      // A jitter during a click is not a drag yet: keep showing the element under the pointer.
      if (rect.width >= MIN_REGION_SIZE || rect.height >= MIN_REGION_SIZE) {
        start.moved = true;
      }
      if (start.moved) {
        showDraft(rect);
        setHovered(null);
        hideHint();
        return;
      }
    }
    if (isOverExtensionSidebar(event.clientX, event.clientY)) {
      hideHint();
      setHovered(null);
      return;
    }
    followHint(event.clientX, event.clientY);
    if (pickMode !== 'element') {
      return;
    }
    const root = elementAt(event.clientX, event.clientY, session.elementSelector);
    const key = root?.getAttribute(session.elementKeyAttribute);
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
    if (capturing || isOverExtensionSidebar(event.clientX, event.clientY)) {
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
    const root = elementAt(event.clientX, event.clientY, session.elementSelector);
    const key = root?.getAttribute(session.elementKeyAttribute);
    if (!root || !key) {
      return;
    }
    const rect = root.getBoundingClientRect();
    const point = {
      x: rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0,
      y: rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0,
    };
    const pick = session.resolveElementPick(key, point);
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
      ref={rootRef}
      className={cx(styles.root, belowStickyControls && styles.rootBelowControls)}
      data-composer-capture-exclude
    >
      <div
        ref={blockerRef}
        className={cx(styles.blocker, picking && !paused && !capturing && styles.picking)}
        data-testid="dashboard-composer-overlay"
        // Pointer-only layer: keyboard users select through the navigator (M3); Escape is handled on window.
        role="presentation"
        aria-hidden
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          setHovered(null);
          hideHint();
        }}
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
      {annotations.map((item) => {
        const { id, label, state } = item;
        const box = layout.items[id];
        if (!box) {
          return null;
        }
        return (
          <button
            key={id}
            type="button"
            className={cx(styles.pin, state === 'active' && styles.pinActive, paused && styles.pinDisabled)}
            style={pinTail(box, item, layout)}
            data-state={state}
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
      {hintCopy && (
        // The same guidance is in Assistant's placeholder and the Select button's tooltip.
        <div ref={hintRef} className={styles.hint} role="tooltip" aria-hidden>
          {hintCopy === 'element'
            ? session.elementHint()
            : t('dashboard.composer.overlay.hint-region', 'Drag to draw a region')}
        </div>
      )}
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

function pinSize(state: ComposerAnnotation['state']) {
  return state === 'active' ? PIN_SIZE_ACTIVE : PIN_SIZE;
}

/**
 * Where a pin's tail tip (its square bottom-left corner) sits, relative to the overlay: on the item's point
 * (a panel's click point, a region's top-right corner), kept far enough inside the overlay that the whole
 * pin shows.
 */
function pinTail(box: Box, { point, state }: Pick<ComposerAnnotation, 'point' | 'state'>, overlay: Size) {
  const size = pinSize(state);
  return {
    left: clamp(box.left + point.x * box.width, 0, Math.max(0, overlay.width - size)),
    top: clamp(box.top + point.y * box.height, size, Math.max(size, overlay.height)),
  };
}

/** The pin's visual centre, where the editor anchor sits: half a pin right of and above the tail tip. */
function pinCentre(box: Box, item: Pick<ComposerAnnotation, 'point' | 'state'>, overlay: Size) {
  const tail = pinTail(box, item, overlay);
  const half = pinSize(item.state) / 2;
  return { left: tail.left + half, top: tail.top - half };
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

/**
 * The extension sidebar's boxes in viewport coordinates: the docked column, or the floating panel with any
 * drag handle that sticks out of it.
 */
function getExtensionSidebarBoxes(): Box[] {
  return [...document.querySelectorAll<HTMLElement>(EXTENSION_SIDEBAR_SELECTOR)]
    .flatMap((sidebar) => [sidebar, ...sidebar.querySelectorAll<HTMLElement>(`[${FLOATING_DRAG_HANDLE_ATTRIBUTE}]`)])
    .map((element) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      return { left, top, width, height };
    })
    .filter((box) => box.width > 0 && box.height > 0);
}

function isOverExtensionSidebar(x: number, y: number): boolean {
  return getExtensionSidebarBoxes().some((box) => containsPoint(box, x, y));
}

function containsPoint(box: Box, x: number, y: number): boolean {
  return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const PIN_SIZE = 26;
const PIN_SIZE_ACTIVE = 28;

interface Size {
  width: number;
  height: number;
}

/**
 * What a wheel at (`x`, `y`) would scroll without Composer's layers: the nearest element under the point,
 * or an ancestor of it, that can still scroll in the wheel's direction.
 */
function findWheelTarget(root: HTMLElement, x: number, y: number, deltaX: number, deltaY: number) {
  const under = document.elementsFromPoint(x, y).find((element) => !root.contains(element));
  for (let node = under instanceof HTMLElement ? under : null; node; node = node.parentElement) {
    if (canScrollBy(node, deltaX, deltaY)) {
      return node;
    }
  }
  return undefined;
}

function canScrollBy(element: HTMLElement, deltaX: number, deltaY: number): boolean {
  const style = getComputedStyle(element);
  const scrollable = (overflow: string) => overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay';
  const maxTop = element.scrollHeight - element.clientHeight;
  const maxLeft = element.scrollWidth - element.clientWidth;
  // One pixel of slack: scroll positions can be fractional at the end.
  const canY =
    scrollable(style.overflowY) &&
    maxTop > 0 &&
    ((deltaY > 0 && element.scrollTop < maxTop - 1) || (deltaY < 0 && element.scrollTop > 0));
  const canX =
    scrollable(style.overflowX) &&
    maxLeft > 0 &&
    ((deltaX > 0 && element.scrollLeft < maxLeft - 1) || (deltaX < 0 && element.scrollLeft > 0));
  return canY || canX;
}

function wheelDeltaToPixels(delta: number, mode: number, pageSize: number): number {
  if (mode === WheelEvent.DOM_DELTA_LINE) {
    return delta * WHEEL_LINE_HEIGHT;
  }
  if (mode === WheelEvent.DOM_DELTA_PAGE) {
    return delta * pageSize;
  }
  return delta;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      position: 'absolute',
      inset: 0,
      // Local to the dashboard container's stacking context, so below app chrome. The sticky dashboard
      // controls sit at `sidemenu` in the same context; anything lower lets them cover pins and outlines.
      // A host must give its container such a context below app chrome, or this layer rises above the
      // extension sidebar (`navbarFixed + 1`) and covers the Assistant.
      zIndex: theme.zIndex.sidemenu + 1,
      pointerEvents: 'none',
    }),
    rootBelowControls: css({
      zIndex: theme.zIndex.sidemenu - 1,
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
    // Grafana blue in both the classic and refreshed themes, like the pins (the refreshed primary is
    // monochrome).
    hover: css({
      outline: `2px solid ${theme.colors.info.border}`,
      background: theme.colors.info.transparent,
    }),
    highlight: css({
      outline: `2px dashed ${theme.colors.info.main}`,
    }),
    active: css({
      outline: `2px solid ${theme.colors.info.border}`,
    }),
    draft: css({
      border: `2px dashed ${theme.colors.info.main}`,
      background: theme.colors.info.transparent,
    }),
    regionActive: css({
      border: `2px solid ${theme.colors.info.border}`,
    }),
    regionStaged: css({
      border: `1px dashed ${theme.colors.info.border}`,
      opacity: 0.6,
    }),
    // A comment bubble: round on three corners, with the square bottom-left corner as the tail on the point.
    // `info` is Grafana's blue in both the classic and refreshed themes (the refreshed `primary` is
    // monochrome, near white on dark), and the ring in the page background separates it from any panel.
    pin: css({
      position: 'absolute',
      transform: 'translateY(-100%)',
      width: PIN_SIZE,
      height: PIN_SIZE,
      padding: 0,
      border: 'none',
      // eslint-disable-next-line @grafana/no-border-radius-literal -- the bubble shape, not a theme radius
      borderRadius: '50% 50% 50% 0',
      background: theme.colors.info.main,
      color: theme.colors.info.contrastText,
      boxShadow: `0 0 0 2px ${theme.colors.background.primary}, ${theme.shadows.z2}`,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightBold,
      lineHeight: `${PIN_SIZE}px`,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      pointerEvents: 'auto',
      '&:focus-visible': getFocusStyles(theme),
    }),
    pinActive: css({
      width: PIN_SIZE_ACTIVE,
      height: PIN_SIZE_ACTIVE,
      lineHeight: `${PIN_SIZE_ACTIVE}px`,
    }),
    pinDisabled: css({
      cursor: 'not-allowed',
    }),
    // The Grafana tooltip's look, without its fade.
    hint: css({
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: 1,
      pointerEvents: 'none',
      maxWidth: 400,
      padding: theme.spacing(0.5, 1),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.components.tooltip.borderColor}`,
      background: theme.components.tooltip.background,
      color: theme.components.tooltip.text,
      boxShadow: theme.shadows.z2,
      fontSize: theme.typography.bodySmall.fontSize,
      whiteSpace: 'nowrap',
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

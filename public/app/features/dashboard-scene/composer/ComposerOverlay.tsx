import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { FLOATING_DRAG_HANDLE_ATTRIBUTE } from 'app/core/components/AppChrome/ExtensionSidebar/useFloatingDrag';

import { type ComposerSession } from './ComposerSession';
import { type Box, DATA_LAYER_CONTROL_SELECTOR, VARIABLE_CONTROL_SELECTOR } from './composerGeometry';
import {
  type ComposerAnnotation,
  type ElementPick,
  type ElementRect,
  type ElementRef,
  type PickedText,
  type RegionPick,
} from './types';

const TAB_SELECTOR = '[role="tab"]';
/** The dashboard controls (time picker, refresh, save, share, variables) stay usable in Composer. */
const CONTROLS_SELECTOR = `[data-testid="${selectors.pages.Dashboard.Controls}"]`;
/** The dashboard body's scroll container in the sidebar layout, a sibling of the overlay. */
const BODY_SCROLLER_SELECTOR = `[data-testid="${selectors.components.DashboardSidebarSplitter.bodyContainer}"]`;
/** The extension sidebar, docked or floating: never part of the document Composer annotates. */
const EXTENSION_SIDEBAR_SELECTOR = '[data-extension-sidebar]';
/** What keeps its own cursor in Composer: the dashboard controls, and the pins and anchors on the overlay. */
const OWN_CURSORS = [CONTROLS_SELECTOR, `${CONTROLS_SELECTOR} *`, '[data-composer-capture-exclude] *'].join(', ');
/** A drawn rectangle smaller than this, in CSS pixels on either side, is ignored. */
const MIN_REGION_SIZE = 8;
/** How far from the pointer the pick hint sits. */
const HINT_OFFSET = 12;
/** The container the plugin portals its tools bar into: never part of the document Composer annotates. */
const TOOLS_HOST_SELECTOR = '[data-composer-tools-host]';
/** Text tool limits, matching what the plugin accepts. */
const MAX_QUOTE_LENGTH = 500;
const MAX_AROUND_LENGTH = 40;
const MAX_TEXT_RECTS = 20;

type HintCopy = 'element' | 'variable' | 'region' | 'text' | 'remove' | 'not-removable';

interface Layout {
  highlight: Box | null;
  /** Element bounds per annotation id; an id without an entry does not resolve and is hidden. */
  items: Record<string, Box>;
  /** The bounds of each annotation's `alsoRefs` that resolve, with their refs, per annotation id. */
  also: Record<string, Array<{ ref: ElementRef; box: Box }>>;
  /** Annotation ids whose text highlight is not drawn, though their pin is. */
  textHidden: Record<string, true>;
  /** The overlay's own size, which pins are kept inside. */
  width: number;
  height: number;
  /**
   * The bottom of the sticky dashboard controls, relative to the overlay, or -Infinity without them. Content
   * scrolled above it is under the controls, so its outlines and pins are not drawn over them.
   */
  controlsBottom: number;
}

const EMPTY_LAYOUT: Layout = {
  highlight: null,
  items: {},
  also: {},
  textHidden: {},
  width: 0,
  height: 0,
  controlsBottom: -Infinity,
};

/**
 * A layer over the dashboard controls and body while Composer is active.
 *
 * The layer itself takes no pointer events: outlines, the hover outline, the region draft and the hint are
 * drawn on it, so pointer moves and the wheel reach the document underneath (tooltips, crosshairs and hover
 * states keep working). Presses, clicks and drags on the document body are Composer's instead: taken on the
 * window in the capture phase before anything underneath sees them, so panel drag, graph drag-to-zoom,
 * menus and links never start. With Select on, a click picks the element under it and a press that moves
 * 8px draws a region. Tab headers and the dashboard controls stay usable. Above the layer sit the
 * annotation pins and the anchors the plugin portals its editor into. All positions are relative to this
 * layer and re-measured on scroll, resize and layout changes.
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
  const { picking, pickMode, paused, capturing, annotations, tool } = overlayState;
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorHostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const [hovered, setHovered] = useState<{ key: string; box: Box } | null>(null);
  /** The last pointer position over the document body, so a scroll under a still pointer re-resolves the hover. */
  const hoverPointerRef = useRef<{ x: number; y: number } | null>(null);
  const hoverFrameRef = useRef(0);
  const [layout, setLayout] = useState<Layout>(EMPTY_LAYOUT);
  /**
   * Where a press started, in viewport coordinates, whether it has since moved far enough to be a drag, and
   * whether a drag draws a region (only Select's does); null when no press is in progress.
   */
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean; region: boolean } | null>(null);
  /** A finished or ignored drag swallows the click that follows its pointer-up. */
  const swallowClickRef = useRef(false);
  const [draft, setDraft] = useState<Box | null>(null);
  /**
   * The pick hint that follows the pointer. React state holds only which copy shows (or none); its position
   * is written to the element once per animation frame, so moving the pointer renders nothing.
   */
  const [hintCopy, setHintCopy] = useState<HintCopy | null>(null);
  /** A press with the Text tool is selecting text: the browser draws the selection, Composer reads it on release. */
  const textPressRef = useRef(false);
  const hintRef = useRef<HTMLDivElement>(null);
  const hintPointerRef = useRef<{ x: number; y: number } | null>(null);
  const hintFrameRef = useRef(0);
  /**
   * A Text highlight's rects are fractions of its element's box, measured at the pick. Once the element's
   * content scrolls or the element resizes, its text has moved under them: the highlight is dropped for good
   * (the pin stays). Per annotation id: the element's size when first drawn, and whether that has happened.
   */
  const textBasisRef = useRef(new Map<string, { width: number; height: number; moved: boolean }>());

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
    const controls = root.parentElement?.querySelector(CONTROLS_SELECTOR)?.getBoundingClientRect();
    const next: Layout = {
      highlight: highlight ? session.resolveBox(highlight, rootRect) : null,
      items: {},
      also: {},
      textHidden: {},
      width: rootRect.width,
      height: rootRect.height,
      controlsBottom: controls ? controls.bottom - rootRect.top : -Infinity,
    };
    const textBasis = textBasisRef.current;
    for (const id of textBasis.keys()) {
      if (!items.some((item) => item.id === id && item.textRects)) {
        textBasis.delete(id);
      }
    }
    for (const item of items) {
      const box = session.resolveAnnotationBox(item, rootRect);
      if (box) {
        next.items[item.id] = box;
      }
      if (item.textRects) {
        const basis = textBasis.get(item.id);
        if (!basis && box && box.width > 0 && box.height > 0) {
          textBasis.set(item.id, { width: box.width, height: box.height, moved: false });
        } else if (basis && box && (Math.abs(basis.width - box.width) > 1 || Math.abs(basis.height - box.height) > 1)) {
          basis.moved = true;
        }
        if (basis?.moved || !session.isTextAnchored(item)) {
          next.textHidden[item.id] = true;
        }
      }
      const also = (item.alsoRefs ?? []).flatMap((ref) => {
        const alsoBox = session.resolveBox(ref, rootRect);
        return alsoBox ? [{ ref, box: alsoBox }] : [];
      });
      if (also.length > 0) {
        next.also[item.id] = also;
      }
    }
    placeToolsHost(session.getToolsHostElement(), root);
    session.getAnchors().forEach((anchor, id) => {
      const item = items.find((candidate) => candidate.id === id);
      const box = next.items[id];
      const position = item && box ? anchorPosition(box, item, next, rootRect) : null;
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
    const onScroll = (event: Event) => {
      // A scroll inside a Text pick's element (a Logs or Table panel's rows), not the dashboard around it.
      const scrolled = event.target;
      if (scrolled instanceof Node) {
        for (const item of session.getOverlayState().annotations) {
          const basis = textBasisRef.current.get(item.id);
          if (basis && item.textRects && session.findAnnotationRoot(item)?.contains(scrolled)) {
            basis.moved = true;
          }
        }
      }
      scheduleMeasure();
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
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
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', scheduleMeasure);
      observer?.disconnect();
    };
  }, [session, scheduleMeasure]);

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
    // Escape cancels a drag, else leaves Composer, before any other Escape handler (exit edit, close view
    // panel) sees it, except inside an annotation anchor: that Escape belongs to the plugin's editor.
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
        session.exit();
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

  const followHint = (x: number, y: number, copy?: HintCopy) => {
    if (!hintAllowed || dragStartRef.current?.moved || textPressRef.current) {
      hideHint();
      return;
    }
    hintPointerRef.current = { x, y };
    cancelAnimationFrame(hintFrameRef.current);
    hintFrameRef.current = requestAnimationFrame(() => {
      const overElement = Boolean(elementAt(x, y, session.elementSelector));
      // Select draws a region anywhere; Text and Remove act on elements only.
      const next = copy ?? (tool === 'select' ? (overElement ? 'element' : 'region') : overElement ? tool : null);
      setHintCopy(next);
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

  /** A drag that started on the controls has ended: the click it would end in must not reach a control. */
  const swallowControlsClickRef = useRef(false);

  // Presses on the controls reach them, but one that moves 8px or more becomes a region drag from the
  // press point, like a drag on the body. The controls receive the pointer here, not the blocking layer,
  // so this listens on the window, in the capture phase to get there first.
  useEffect(() => {
    // Only Select draws regions.
    if (!picking || paused || capturing || tool !== 'select') {
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
        dragStartRef.current = { x: press.x, y: press.y, moved: true, region: true };
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
      const region =
        rect.width < MIN_REGION_SIZE || rect.height < MIN_REGION_SIZE ? null : session.createRegionPick(rect);
      if (region) {
        session.completePick(withModifier(region, event));
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
  }, [picking, paused, capturing, tool, isOverControls, toDraft, showDraft, hideHint, session]);

  // Outlives the pick the drag resolved, since its click arrives after the pick has ended.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (swallowControlsClickRef.current) {
        swallowControlsClickRef.current = false;
        event.preventDefault();
        // Also keeps the annotation-label and variable picks below from treating it as a click.
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

  // With Select, a click on an annotation's label picks it; its toggle still works as usual.
  useEffect(() => {
    if (pickMode !== 'element' || paused || capturing) {
      return;
    }
    const onClick = (event: MouseEvent) => {
      const container = rootRef.current?.parentElement;
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>(DATA_LAYER_CONTROL_SELECTOR);
      const label = target?.closest('label');
      const key = control?.getAttribute('data-dashboard-element-key');
      if (!container?.contains(control ?? null) || !label || !control?.contains(label) || !key) {
        return;
      }
      const resolved = session.resolveAnnotationPick(key);
      if (!resolved) {
        return;
      }
      // The label would otherwise focus the value picker.
      event.preventDefault();
      event.stopImmediatePropagation();
      // Text has nothing to select on a layer's label; a data layer Grafana adds itself cannot be removed.
      if (tool === 'text' || (tool === 'remove' && isDataLayer(resolved.ref))) {
        return;
      }
      session.completePick(withTool(withModifier(resolved, event), tool));
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [pickMode, paused, capturing, tool, session]);

  /**
   * Whether an event on `target` is on the document body, which Composer takes presses and clicks from: inside
   * the container the overlay covers (or on the overlay's own drawn layer), but not on the dashboard controls,
   * a pin or an anchor the plugin draws into. A portalled menu or the extension sidebar is outside it.
   */
  const isOnDocumentBody = useCallback((target: EventTarget | null): target is Element => {
    const root = rootRef.current;
    const container = root?.parentElement;
    if (!(target instanceof Element) || !root || !container) {
      return false;
    }
    if (
      anchorHostRef.current?.contains(target) ||
      target.closest('[data-composer-annotation-pin]') ||
      target.closest(TOOLS_HOST_SELECTOR)
    ) {
      return false;
    }
    if (root.contains(target)) {
      return true;
    }
    return container.contains(target) && !target.closest(CONTROLS_SELECTOR);
  }, []);

  // Presses, clicks and drags on the document body are Composer's; pointer moves and the wheel pass through.
  // On the window in the capture phase, so nothing underneath sees a press it would start a drag from.
  useEffect(() => {
    /** A tab header keeps switching tabs, except while a capture renders the current one. */
    const isUsableTab = (target: Element) => !capturing && Boolean(target.closest(TAB_SELECTOR));
    /**
     * On the body, and not where the sticky controls band is: content scrolled under it is covered by it.
     * The point check covers a target the band does not contain, such as the overlay's own layer.
     */
    const onBody = (event: MouseEvent): event is MouseEvent & { target: Element } =>
      isOnDocumentBody(event.target) && !isOverControls(event.clientX, event.clientY);

    /** With Select, a variable's control is picked whole, like a panel: its value picker does not open. */
    const variableAt = (target: EventTarget | null): HTMLElement | null => {
      if (!picking || paused || capturing || pickMode !== 'element' || !(target instanceof Element)) {
        return null;
      }
      const control = target.closest<HTMLElement>(VARIABLE_CONTROL_SELECTOR);
      return control && rootRef.current?.parentElement?.contains(control) ? control : null;
    };

    /** A data layer's control Grafana adds itself (alert states), which Remove cannot mark. */
    const dataLayerAt = (target: EventTarget | null): boolean => {
      const control = target instanceof Element ? target.closest<HTMLElement>(DATA_LAYER_CONTROL_SELECTOR) : null;
      const key = control?.getAttribute('data-dashboard-element-key');
      const pick = key && rootRef.current?.parentElement?.contains(control) ? session.resolveAnnotationPick(key) : null;
      return Boolean(pick && isDataLayer(pick.ref));
    };

    /** With Text, a press inside an element selects its text: the browser's default, not the page's handlers. */
    const selectsText = (event: MouseEvent): boolean =>
      tool === 'text' &&
      picking &&
      !paused &&
      !capturing &&
      event.button === 0 &&
      onBody(event) &&
      Boolean(elementAt(event.clientX, event.clientY, session.elementSelector));

    const block = (event: MouseEvent) => {
      if ((event.type === 'mousedown' || event.type === 'dblclick') && selectsText(event)) {
        event.stopPropagation();
        return;
      }
      if ((onBody(event) && !isUsableTab(event.target)) || variableAt(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (variableAt(event.target)) {
        // Kept from the value picker; a drag from here still draws a region, through the controls' drag.
        event.preventDefault();
        event.stopPropagation();
        hideHint();
        return;
      }
      if (!onBody(event) || isUsableTab(event.target)) {
        return;
      }
      hideHint();
      swallowClickRef.current = false;
      if (selectsText(event)) {
        // Nothing underneath sees the press, but the browser still starts a selection from it.
        event.stopPropagation();
        window.getSelection()?.removeAllRanges();
        textPressRef.current = true;
        return;
      }
      // Blocked before anything underneath sees it: no panel drag, no graph drag-to-zoom, no focus or
      // selection, no menu.
      event.preventDefault();
      event.stopPropagation();
      // Any primary-button press may become a drag. With Select a click picks an element and a drag draws a
      // region; with Remove a click marks an element and a drag does nothing, not even pick on release. Inside
      // the extension sidebar nothing starts, should a host stack the sidebar under the document.
      if (
        event.button !== 0 ||
        !picking ||
        paused ||
        capturing ||
        isOverExtensionSidebar(event.clientX, event.clientY)
      ) {
        return;
      }
      dragStartRef.current = { x: event.clientX, y: event.clientY, moved: false, region: tool === 'select' };
    };

    const onPointerMove = (event: PointerEvent) => {
      const start = dragStartRef.current;
      if (start) {
        const rect = toDraft(start, event.clientX, event.clientY);
        // A jitter during a click is not a drag yet: keep showing the element under the pointer.
        if (rect.width >= MIN_REGION_SIZE || rect.height >= MIN_REGION_SIZE) {
          start.moved = true;
        }
        if (start.moved) {
          window.getSelection()?.removeAllRanges();
          if (start.region) {
            showDraft(rect);
          }
          setHovered(null);
          hideHint();
          return;
        }
      }
      if (!picking || paused || capturing) {
        return;
      }
      if (tool === 'remove' && dataLayerAt(event.target)) {
        // Said where the user is looking rather than only refused on click.
        setHovered(null);
        followHint(event.clientX, event.clientY, 'not-removable');
        return;
      }
      const variable = variableAt(event.target);
      if (!variable && (!onBody(event) || isOverExtensionSidebar(event.clientX, event.clientY))) {
        hoverPointerRef.current = null;
        hideHint();
        setHovered(null);
        return;
      }
      // The controls do not scroll, so a variable needs no re-hover on scroll.
      hoverPointerRef.current = variable ? null : { x: event.clientX, y: event.clientY };
      hoverAt(event.clientX, event.clientY, variable);
    };

    const hoverAt = (x: number, y: number, variable: HTMLElement | null = null) => {
      if (textPressRef.current) {
        return;
      }
      if (variable && tool === 'text') {
        hideHint();
        setHovered(null);
        return;
      }
      followHint(x, y, variable ? (tool === 'remove' ? 'remove' : 'variable') : undefined);
      if (pickMode !== 'element') {
        return;
      }
      const picked = pickableAt(x, y, variable);
      const box = picked ? boxFor(picked.element) : null;
      setHovered(picked && box ? { key: picked.key, box } : null);
    };

    /** What Select picks at a point: the variable the pointer is on, else the element under it. */
    const pickableAt = (x: number, y: number, variable: HTMLElement | null) => {
      const element = variable ?? elementAt(x, y, session.elementSelector);
      const key = variable
        ? variable.getAttribute('data-dashboard-element-key')
        : element?.getAttribute(session.elementKeyAttribute);
      return element && key ? { element, key } : null;
    };

    // The wheel scrolls the document under a still pointer, which fires no pointer move.
    const onScroll = () => {
      const pointer = hoverPointerRef.current;
      if (!pointer || !picking || paused || capturing || dragStartRef.current) {
        return;
      }
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = requestAnimationFrame(() => hoverAt(pointer.x, pointer.y));
    };

    const onPointerUp = (event: PointerEvent) => {
      if (textPressRef.current) {
        textPressRef.current = false;
        event.stopPropagation();
        // The click that follows is the selection's end, not a pick.
        swallowClickRef.current = true;
        const container = rootRef.current?.parentElement;
        const picked = container
          ? readTextSelection(container, session.elementSelector, session.elementKeyAttribute)
          : null;
        window.getSelection()?.removeAllRanges();
        if (!picked) {
          return;
        }
        const pick = session.resolveTextPick(picked.key, picked.point, picked.text);
        if (pick) {
          session.completePick(pick);
        }
        return;
      }
      const start = dragStartRef.current;
      if (!start) {
        return;
      }
      event.stopPropagation();
      dragStartRef.current = null;
      setDraft(null);
      const rect = toDraft(start, event.clientX, event.clientY);
      if (!start.moved && rect.width < MIN_REGION_SIZE && rect.height < MIN_REGION_SIZE) {
        // Never moved far enough to be a drag: with Select it is a click on the element; the Region tool
        // ignores it.
        swallowClickRef.current = pickMode === 'region';
        return;
      }
      // A drag never turns back into a click; one too thin for a region, or with a tool that draws none, is
      // dropped and the pick stays pending.
      swallowClickRef.current = true;
      if (!start.region || rect.width < MIN_REGION_SIZE || rect.height < MIN_REGION_SIZE) {
        return;
      }
      const region = session.createRegionPick(rect);
      if (region) {
        session.completePick(withModifier(region, event));
      }
    };

    const onClick = (event: MouseEvent) => {
      const variable = variableAt(event.target);
      if (!variable && (!onBody(event) || isUsableTab(event.target))) {
        return;
      }
      // Legends, links and panel menus never respond to a click while Composer is open.
      event.preventDefault();
      event.stopPropagation();
      if (swallowClickRef.current) {
        swallowClickRef.current = false;
        return;
      }
      // A capture renders the current tab: nothing changes under it until it settles.
      if (
        !picking ||
        paused ||
        capturing ||
        pickMode !== 'element' ||
        // Text picks on release of a selection, never on a click.
        tool === 'text' ||
        isOverExtensionSidebar(event.clientX, event.clientY)
      ) {
        return;
      }
      const picked = pickableAt(event.clientX, event.clientY, variable);
      if (!picked) {
        return;
      }
      const rect = picked.element.getBoundingClientRect();
      const point = {
        x: rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0,
        y: rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0,
      };
      const pick = variable ? session.resolveVariablePick(picked.key) : session.resolveElementPick(picked.key, point);
      if (pick) {
        session.completePick(withTool(withModifier(pick, event), tool));
      }
    };

    const onPointerCancel = () => {
      textPressRef.current = false;
      cancelDrag();
    };

    const blocked = ['mousedown', 'dblclick', 'auxclick', 'contextmenu', 'dragstart'] as const;
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    blocked.forEach((type) => window.addEventListener(type, block, true));
    return () => {
      cancelAnimationFrame(hoverFrameRef.current);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('scroll', onScroll, { capture: true });
      blocked.forEach((type) => window.removeEventListener(type, block, true));
    };
    // `elementAt` and `followHint` read refs and session only; they are recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    picking,
    pickMode,
    tool,
    paused,
    capturing,
    session,
    isOnDocumentBody,
    isOverControls,
    toDraft,
    showDraft,
    hideHint,
    cancelDrag,
    boxFor,
  ]);

  // The cursor says what a press does: a crosshair while Select is on, the arrow otherwise, since nothing in
  // the document body responds to a click. Set on the container, so the dashboard controls keep theirs.
  useEffect(() => {
    const container = rootRef.current?.parentElement;
    if (!container) {
      return;
    }
    const active = picking && !paused && !capturing;
    const picker = tool === 'text' ? styles.cursorText : tool === 'remove' ? styles.cursorRemove : styles.cursorPicking;
    const classNames = [active ? picker : styles.cursorInert];
    if (active && pickMode === 'element' && tool !== 'text') {
      classNames.push(styles.cursorPickingVariables);
    }
    container.classList.add(...classNames);
    return () => container.classList.remove(...classNames);
  }, [
    picking,
    pickMode,
    tool,
    paused,
    capturing,
    styles.cursorPicking,
    styles.cursorText,
    styles.cursorRemove,
    styles.cursorInert,
    styles.cursorPickingVariables,
  ]);

  const highlightBox =
    layout.highlight && overlayState.highlight
      ? belowControls(overlayState.highlight, layout.highlight, layout.controlsBottom)
      : null;

  return (
    <div
      ref={rootRef}
      className={cx(styles.root, belowStickyControls && styles.rootBelowControls)}
      data-composer-capture-exclude
    >
      <div
        className={styles.drawn}
        data-testid="dashboard-composer-overlay"
        // A drawn layer only: the pointer goes through it to the document, Escape is handled on window.
        role="presentation"
        aria-hidden
      >
        {highlightBox && <div className={cx(styles.box, styles.highlight)} style={highlightBox} />}
        {annotations.flatMap(({ id, ref, state, tone, textRects }) => {
          // The comment's own element, then the others it covers, each outlined by its kind.
          const outlines = [
            { ref, box: layout.items[id], testId: `composer-annotation-outline-${id}` },
            ...(layout.also[id] ?? []).map((also, index) => ({
              ...also,
              testId: `composer-annotation-outline-${id}-also-${index}`,
            })),
          ];
          const drawn = outlines.map(({ ref: outlined, box: measured, testId }) => {
            const box = measured && belowControls(outlined, measured, layout.controlsBottom);
            // Panels are outlined only while active; regions and elements marked for removal always, faint while
            // staged.
            if (!box || (outlined.kind !== 'region' && state !== 'active' && tone !== 'remove')) {
              return null;
            }
            const outline =
              tone === 'remove'
                ? state === 'active'
                  ? styles.removeActive
                  : styles.removeStaged
                : outlined.kind === 'region'
                  ? state === 'active'
                    ? styles.regionActive
                    : styles.regionStaged
                  : styles.active;
            return (
              <div
                key={testId}
                className={cx(styles.box, outline)}
                style={box}
                data-testid={testId}
                data-state={state}
                data-tone={tone}
              />
            );
          });
          // A Text pick's selection, on its element: one box per line, relative to the element as measured now.
          const element = layout.textHidden[id] ? undefined : layout.items[id];
          const highlights = element
            ? (textRects ?? []).flatMap((rect, index) => {
                const box = belowControls(ref, rectIn(element, rect), layout.controlsBottom);
                return box
                  ? [
                      <div
                        key={`composer-text-${id}-${index}`}
                        className={cx(styles.box, state === 'active' ? styles.textActive : styles.textStaged)}
                        style={box}
                        data-testid={`composer-annotation-text-${id}-${index}`}
                      />,
                    ]
                  : [];
              })
            : [];
          return [...highlights, ...drawn];
        })}
        {picking && hovered && <div className={cx(styles.box, styles.hover)} style={hovered.box} />}
        {draft && <div className={cx(styles.box, styles.draft)} style={draft} data-testid="composer-region-draft" />}
      </div>
      {annotations.map((item) => {
        const { id, label, state, tone } = item;
        const box = layout.items[id];
        if (!box || isPinUnderControls(box, item, layout)) {
          return null;
        }
        return (
          <button
            key={id}
            type="button"
            className={cx(
              styles.pin,
              state === 'active' && styles.pinActive,
              tone === 'remove' && styles.pinRemove,
              paused && styles.pinDisabled
            )}
            style={pinTail(box, item, layout)}
            data-state={state}
            data-tone={tone}
            aria-label={
              tone === 'remove'
                ? t('dashboard.composer.annotation-pin-remove', 'Comment {{label}}, marked for removal', { label })
                : t('dashboard.composer.annotation-pin', 'Comment {{label}}', { label })
            }
            aria-disabled={paused || undefined}
            data-testid={`composer-annotation-pin-${id}`}
            data-composer-annotation-pin=""
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
            {tone === 'remove' && <Icon name="trash-alt" size="xs" aria-hidden />}
            {label}
          </button>
        );
      })}
      {hintCopy && (
        // The same guidance is in Assistant's placeholder and the Select button's tooltip.
        <div ref={hintRef} className={styles.hint} role="tooltip" aria-hidden>
          {hintText(hintCopy, session)}
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

/**
 * Whether an element lies in the dashboard body, so content scrolled under the sticky controls covers it.
 * Variables and annotation layers are in the controls, and a region may be drawn over them.
 */
function scrollsUnderControls(ref: ElementRef): boolean {
  return ref.kind === 'panel' || ref.kind === 'row' || ref.kind === 'tab' || ref.kind === 'cell';
}

/** How far an outline is drawn outside its box (2px), and room for it when the box is clipped. */
const OUTLINE_BLEED = 4;
/** The space between the sticky controls and an open editor held below them: one spacing step. */
const CONTROLS_GAP = 8;

/**
 * A body element's box with the part under the sticky controls clipped off, so its outline never draws over
 * them; null when the controls cover all of it. Anything else is returned as it is.
 */
function belowControls(ref: ElementRef, box: Box, controlsBottom: number): (Box & { clipPath?: string }) | null {
  const covered = controlsBottom - box.top;
  if (!scrollsUnderControls(ref) || covered <= 0) {
    return box;
  }
  if (covered >= box.height) {
    return null;
  }
  return { ...box, clipPath: `inset(${covered}px -${OUTLINE_BLEED}px -${OUTLINE_BLEED}px)` };
}

/** Whether a body element's pin would sit on the sticky controls: it is hidden, with its editor anchor. */
function isPinUnderControls(box: Box, item: Pick<ComposerAnnotation, 'ref' | 'point' | 'state'>, layout: Layout) {
  return scrollsUnderControls(item.ref) && pinTail(box, item, layout).top - pinSize(item.state) < layout.controlsBottom;
}

/** The pin's visual centre, where the editor anchor sits: half a pin right of and above the tail tip. */
function pinCentre(box: Box, item: Pick<ComposerAnnotation, 'point' | 'state'>, overlay: Size) {
  const tail = pinTail(box, item, overlay);
  const half = pinSize(item.state) / 2;
  return { left: tail.left + half, top: tail.top - half };
}

/**
 * Where an item's editor anchor sits, relative to the overlay: the pin's centre, clamped to what is visible
 * (the viewport, below the sticky controls for an element in the dashboard body). An active item's anchor
 * holds the open editor, so it stays at the nearest visible edge however far its element scrolls, and the
 * editor never disappears mid-comment. A staged item's anchor (a hover preview) is null, and hidden, while
 * its pin is not shown: its element entirely off-screen, or its pin under the controls.
 */
function anchorPosition(
  box: Box,
  item: Pick<ComposerAnnotation, 'ref' | 'point' | 'state'>,
  layout: Layout,
  root: DOMRect
): { left: number; top: number } | null {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = root.left + box.left;
  const top = root.top + box.top;
  const offScreen = left > viewportWidth || top > viewportHeight || left + box.width < 0 || top + box.height < 0;
  if (item.state !== 'active' && (offScreen || isPinUnderControls(box, item, layout))) {
    return null;
  }
  const minTop =
    scrollsUnderControls(item.ref) && Number.isFinite(layout.controlsBottom)
      ? root.top + layout.controlsBottom + CONTROLS_GAP
      : 0;
  const pin = pinCentre(box, item, layout);
  const x = clamp(root.left + pin.left, 0, viewportWidth);
  const y = clamp(root.top + pin.top, Math.min(minTop, viewportHeight), viewportHeight);
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

function hintText(copy: HintCopy, session: ComposerSession<unknown>): string {
  switch (copy) {
    case 'element':
      return session.elementHint();
    case 'variable':
      return t('dashboard.composer.overlay.hint-variable', 'Click to comment on a variable, or drag to draw a region');
    case 'region':
      return t('dashboard.composer.overlay.hint-region', 'Drag to draw a region');
    case 'text':
      return t('dashboard.composer.overlay.hint-text', 'Select text to comment on it');
    case 'remove':
      return t('dashboard.composer.overlay.hint-remove', 'Click to mark for removal');
    case 'not-removable':
      return t('dashboard.composer.overlay.hint-not-removable', "Built-in layers can't be removed");
  }
}

/**
 * Places the tools host over the visible part of the dashboard body: the body's scroll container beside the
 * overlay, else the overlay's container, clipped to the viewport. Writes only on change.
 */
function placeToolsHost(host: HTMLDivElement | null, root: HTMLElement) {
  const container = root.parentElement;
  if (!host || !container) {
    return;
  }
  if (host.parentElement !== root) {
    root.insertBefore(host, root.lastElementChild);
  }
  const body = container.querySelector(BODY_SCROLLER_SELECTOR);
  const rect = (body instanceof HTMLElement ? body : container).getBoundingClientRect();
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const width = Math.max(Math.min(rect.right, window.innerWidth) - left, 0);
  const height = Math.max(Math.min(rect.bottom, window.innerHeight) - top, 0);
  const next = { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` };
  for (const [key, value] of Object.entries(next)) {
    if (host.style.getPropertyValue(key) !== value) {
      host.style.setProperty(key, value);
    }
  }
}

/** A rectangle normalised to an element, in the overlay's coordinates. */
function rectIn(element: Box, rect: ElementRect): Box {
  return {
    left: element.left + rect.x * element.width,
    top: element.top + rect.y * element.height,
    width: rect.width * element.width,
    height: rect.height * element.height,
  };
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The part of a text node a range covers. */
interface TextSlice {
  node: Text;
  start: number;
  end: number;
}

/** The text nodes under `root` that `range` covers, each with the part it covers, in document order. */
function textSlices(root: HTMLElement, range: Range): TextSlice[] {
  const slices: TextSlice[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node instanceof Text) || !range.intersectsNode(node)) {
      continue;
    }
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end > start) {
      slices.push({ node, start, end });
    }
  }
  return slices;
}

/**
 * Reads text as it is drawn inside `root`, not as `Range.toString()` gives it: text under `display: none` or
 * `visibility: hidden` is left out, and text in different blocks or table cells is kept apart by a space, so
 * `checkout-api` and `500` in two cells read `checkout-api 500`. Whitespace is collapsed. Reading stops once
 * `limit` characters are read, from the start or, `backward`, from the end.
 */
function renderedTextReader(root: HTMLElement) {
  const styles = new Map<Element, CSSStyleDeclaration>();
  const styleOf = (element: Element) => {
    let style = styles.get(element);
    if (!style) {
      style = getComputedStyle(element);
      styles.set(element, style);
    }
    return style;
  };
  const displayed = new Map<Element, boolean>();
  const isDisplayed = (element: Element): boolean => {
    let result = displayed.get(element);
    if (result === undefined) {
      const parent = element.parentElement;
      result = styleOf(element).display !== 'none' && (element === root || !parent || isDisplayed(parent));
      displayed.set(element, result);
    }
    return result;
  };
  const isShown = (node: Text) => {
    const parent = node.parentElement;
    if (!parent || !isDisplayed(parent)) {
      return false;
    }
    // Inherited, so the parent's computed value is the text's.
    const { visibility } = styleOf(parent);
    return visibility !== 'hidden' && visibility !== 'collapse';
  };
  /** The closest block or cell the node is laid out in, up to `root`. */
  const blockOf = (node: Text): Element => {
    for (let element = node.parentElement; element && element !== root; element = element.parentElement) {
      const display = styleOf(element).display;
      if (display !== 'contents' && !display.startsWith('inline')) {
        return element;
      }
    }
    return root;
  };

  return {
    isShown,
    read(slices: TextSlice[], limit: number, direction: 'forward' | 'backward' = 'forward'): string {
      const backward = direction === 'backward';
      let text = '';
      let block: Element | undefined;
      for (const { node, start, end } of backward ? [...slices].reverse() : slices) {
        if (!isShown(node)) {
          continue;
        }
        const nextBlock = blockOf(node);
        let piece = node.data.slice(start, end).replace(/\s+/g, ' ');
        if (block !== undefined && nextBlock !== block) {
          piece = backward ? `${piece} ` : ` ${piece}`;
        }
        block = nextBlock;
        text = backward ? `${piece}${text}` : `${text}${piece}`;
        if (text.replace(/\s+/g, ' ').trim().length >= limit) {
          break;
        }
      }
      return oneLine(text);
    },
  };
}

/**
 * The line boxes of the selected text, in viewport coordinates, at most `MAX_TEXT_RECTS`. Measured per text
 * node, since a range's own rects include the whole box of every element it fully covers (a table cell, a
 * block), and pieces of one line side by side (a highlighted word) are merged into one box.
 */
function textLines(
  slices: TextSlice[],
  isShown: (node: Text) => boolean
): Array<{ left: number; top: number; right: number; bottom: number }> {
  const lines: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  for (const { node, start, end } of slices) {
    if (!isShown(node)) {
      continue;
    }
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    // jsdom lays nothing out.
    if (typeof range.getClientRects !== 'function') {
      return lines;
    }
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      const previous = lines.at(-1);
      const sameLine =
        previous &&
        Math.abs(previous.top - rect.top) < 1 &&
        Math.abs(previous.bottom - rect.bottom) < 1 &&
        rect.left <= previous.right + 1 &&
        rect.right >= previous.left - 1;
      if (previous && sameLine) {
        previous.left = Math.min(previous.left, rect.left);
        previous.right = Math.max(previous.right, rect.right);
        continue;
      }
      if (lines.length === MAX_TEXT_RECTS) {
        return lines;
      }
      lines.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    }
  }
  return lines;
}

/**
 * The text the user selected with the Text tool, inside the element the selection started in: its words,
 * the words around it, where it was drawn, and the pin's point (the bottom-right of its last line). A selection
 * that runs on into another element is cut at that element's edge. Null when nothing was selected inside an
 * element of `container`.
 */
function readTextSelection(
  container: HTMLElement,
  elementSelector: string,
  keyAttribute: string
): { key: string; text: PickedText; point: { x: number; y: number } } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  const anchor = selection.anchorNode;
  const anchorElement = anchor instanceof Element ? anchor : anchor?.parentElement;
  const root = anchorElement?.closest<HTMLElement>(elementSelector);
  const key = root?.getAttribute(keyAttribute);
  if (!root || !key || !container.contains(root)) {
    return null;
  }
  const range = selection.getRangeAt(0).cloneRange();
  if (!root.contains(range.startContainer)) {
    range.setStart(root, 0);
  }
  if (!root.contains(range.endContainer)) {
    range.setEnd(root, root.childNodes.length);
  }
  const text = renderedTextReader(root);
  // A little past the quote's limit, so a cut quote's suffix starts where the quote stops.
  const slices = textSlices(root, range);
  const selected = text.read(slices, MAX_QUOTE_LENGTH + MAX_AROUND_LENGTH);
  const quote = selected.slice(0, MAX_QUOTE_LENGTH).trim();
  if (!quote) {
    return null;
  }
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const after = document.createRange();
  after.selectNodeContents(root);
  after.setStart(range.endContainer, range.endOffset);
  const prefix = text.read(textSlices(root, before), MAX_AROUND_LENGTH, 'backward').slice(-MAX_AROUND_LENGTH).trim();
  const following = text.read(textSlices(root, after), MAX_AROUND_LENGTH);
  const suffix = oneLine(
    selected.length > MAX_QUOTE_LENGTH ? `${selected.slice(MAX_QUOTE_LENGTH)} ${following}` : following
  )
    .slice(0, MAX_AROUND_LENGTH)
    .trim();

  const bounds = root.getBoundingClientRect();
  const lines = textLines(slices, text.isShown);
  const norm = (value: number, size: number) => (size > 0 ? clamp(value / size, 0, 1) : 0);
  const rects = lines.map((rect) => ({
    x: norm(rect.left - bounds.left, bounds.width),
    y: norm(rect.top - bounds.top, bounds.height),
    width: norm(rect.right - rect.left, bounds.width),
    height: norm(rect.bottom - rect.top, bounds.height),
  }));
  const last = lines.at(-1);
  // The pin rises from its point, so its point is the last line's bottom-right: on a line at the top of its
  // element (a panel title) a pin from the line's top would stick out above the element, and under the sticky
  // dashboard controls it is hidden.
  const point = last
    ? { x: norm(last.right - bounds.left, bounds.width), y: norm(last.bottom - bounds.top, bounds.height) }
    : { x: 1, y: 0 };
  return {
    key,
    text: { quote, ...(prefix ? { prefix } : {}), ...(suffix ? { suffix } : {}), rects },
    point,
  };
}

function isDataLayer(ref: ElementRef): boolean {
  return ref.kind === 'annotation' && ref.layerKind === 'data-layer';
}

/** `pick` marked with the tool that made it, when that is not Select. */
function withTool(pick: ElementPick, tool: 'select' | 'text' | 'remove'): ElementPick {
  return tool === 'remove' ? { ...pick, tool } : pick;
}

/** `pick` with whether ⌘ (macOS) or Ctrl was held: such a pick adds to the open comment. */
function withModifier<P extends ElementPick | RegionPick>(pick: P, event: { metaKey: boolean; ctrlKey: boolean }): P {
  return { ...pick, additive: event.metaKey || event.ctrlKey };
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
    drawn: css({
      position: 'absolute',
      inset: 0,
      background: 'transparent',
      pointerEvents: 'none',
    }),
    // On the container the overlay covers, outside the dashboard controls, which keep their own cursors.
    cursorPicking: css({
      [`& *:not(${OWN_CURSORS})`]: { cursor: 'crosshair' },
    }),
    cursorInert: css({
      [`& *:not(${OWN_CURSORS})`]: { cursor: 'default' },
    }),
    cursorText: css({
      [`& *:not(${OWN_CURSORS})`]: { cursor: 'text', userSelect: 'text' },
    }),
    cursorRemove: css({
      [`& *:not(${OWN_CURSORS})`]: { cursor: 'pointer' },
    }),
    // With Select, variables in the controls are picked like panels.
    cursorPickingVariables: css({
      [`& ${VARIABLE_CONTROL_SELECTOR}, & ${VARIABLE_CONTROL_SELECTOR} *`]: { cursor: 'crosshair' },
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
    removeActive: css({
      outline: `2px solid ${theme.colors.error.border}`,
      background: theme.colors.error.transparent,
    }),
    removeStaged: css({
      outline: `2px dashed ${theme.colors.error.border}`,
      background: theme.colors.error.transparent,
    }),
    textActive: css({
      background: theme.colors.info.transparent,
      boxShadow: `inset 0 -2px 0 ${theme.colors.info.border}`,
    }),
    textStaged: css({
      background: theme.colors.info.transparent,
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
    // Room for the trash icon beside the number; the colour is not the only sign of removal.
    pinRemove: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      width: 'auto',
      minWidth: PIN_SIZE,
      padding: theme.spacing(0, 0.75),
      background: theme.colors.error.main,
      color: theme.colors.error.contrastText,
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

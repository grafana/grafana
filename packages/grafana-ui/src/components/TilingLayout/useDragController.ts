import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { detachPanel, detachView, locatePanel, moveTab, selectView } from './model/document';
import { applyDrop, createDropSlot } from './model/drop';
import { type FloatingHitRect, hitTest, targetKey } from './model/hitTest';
import { type ComputedLayout, insetRect, rectContains } from './model/layout';
import { createId, DROP_SLOT_ID, findNode } from './model/tree';
import {
  type DropTarget,
  type LayoutDocument,
  type LayoutMetrics,
  type PanelNode,
  type PanelRegion,
  type Point,
  type Rect,
} from './model/types';
import { MOTION } from './styles';

const DRAG_THRESHOLD = 6;
const COMPACT_MAX = { w: 380, h: 260 };
const TEAR_OUT_TOLERANCE = 8;

export type DropKind = 'dock' | 'tab' | 'float' | 'none';

export interface DragView {
  /** The document to lay out while dragging: the original, or a preview with the drop slot. */
  displayDoc: LayoutDocument;
  lifted?: { panel: PanelNode; rect: Rect; region: PanelRegion };
  /** A panel of `displayDoc` that is lifted and must not be drawn in place. */
  hiddenPanelId?: string;
  sourceSlotRect?: Rect;
  target: DropTarget | null;
  dropKind: DropKind;
  tabGap?: { panelId: string; index: number; width: number };
  reorder?: { panelId: string; viewId: string; offsetX: number; shifts: Record<string, number> };
}

export interface DropCommit {
  doc: LayoutDocument;
  panelId: string;
  focusViewId: string;
  announce: boolean;
}

export interface DragControllerOptions {
  rootRef: React.RefObject<HTMLDivElement | null>;
  metrics: LayoutMetrics;
  getDoc: () => LayoutDocument;
  getViewport: () => Rect;
  getLayout: (doc: LayoutDocument) => ComputedLayout;
  getFloatingRects: (doc: LayoutDocument) => FloatingHitRect[];
  getFramedId: () => string | null;
  onCommit: (commit: DropCommit) => void;
  onDragStart?: () => void;
}

type Source =
  | { kind: 'panel'; panelId: string; region: PanelRegion }
  | { kind: 'view'; viewId: string; panelId: string; region: PanelRegion };

interface TabMeasure {
  id: string;
  left: number;
  width: number;
}

interface Session {
  pointerId: number;
  start: Point;
  pointer: Point;
  rootRect: DOMRect;
  source: Source;
  original: LayoutDocument;
  mode: 'pending' | 'reorder' | 'lift';
  reorder?: { tabs: TabMeasure[]; origIndex: number; index: number; tabBarRect: Rect; panelRect: Rect };
  lift?: LiftState;
}

interface LiftState {
  base: LayoutDocument;
  payload: PanelNode;
  region: PanelRegion;
  startRect: Rect;
  grab: Point;
  compactOnly: boolean;
  isFloatMove: boolean;
  size: { w: number; h: number };
  sizeFrom: { w: number; h: number };
  sizeTo: { w: number; h: number };
  sizeStart: number;
  rect: Rect;
  collapsed: boolean;
  candidate: DropTarget | null;
  pending: DropTarget | null | undefined;
  current: DropTarget | null;
  settleTimer?: ReturnType<typeof setTimeout>;
  displayDoc: LayoutDocument;
  tabWidth: number;
}

function hasModifier(e: { altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
  return e.altKey || e.shiftKey || e.ctrlKey || e.metaKey;
}

function compactSize(size: { w: number; h: number }) {
  const scale = Math.min(1, COMPACT_MAX.w / size.w, COMPACT_MAX.h / size.h);
  return { w: size.w * scale, h: size.h * scale };
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function sameSize(a: { w: number; h: number }, b: { w: number; h: number }) {
  return Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
}

function toFraction(rect: Rect, viewport: Rect): Rect {
  return { x: rect.x / viewport.w, y: rect.y / viewport.h, w: rect.w / viewport.w, h: rect.h / viewport.h };
}

/** Drag and drop of tabs and panels: reordering, tearing out, docking and floating. */
export function useDragController(options: DragControllerOptions) {
  const [view, setView] = useState<DragView | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const sessionRef = useRef<Session | null>(null);
  const frameRef = useRef<number | null>(null);
  const listenersRef = useRef<(() => void) | null>(null);

  const toLocal = (session: Session, e: { clientX: number; clientY: number }): Point => ({
    x: e.clientX - session.rootRect.left,
    y: e.clientY - session.rootRect.top,
  });

  const queryStrip = (panelId: string) =>
    optionsRef.current.rootRef.current?.querySelector<HTMLElement>(
      `[data-tiling-tabs="${CSS.escape(panelId)}"]:not([data-lifted-strip])`
    ) ?? null;

  const tabIndexAt = useCallback((panelId: string, x: number) => {
    const session = sessionRef.current;
    const strip = queryStrip(panelId);
    if (!strip || !session) {
      return 0;
    }
    const stripRect = strip.getBoundingClientRect();
    const origin = stripRect.left - session.rootRect.left - strip.scrollLeft;
    let index = 0;
    strip.querySelectorAll<HTMLElement>('[data-tiling-tab]').forEach((tab) => {
      if (x > origin + tab.offsetLeft + tab.offsetWidth / 2) {
        index++;
      }
    });
    return index;
  }, []);

  const rectOfPanel = (doc: LayoutDocument, panelId: string): Rect | undefined => {
    const { getLayout, getFloatingRects } = optionsRef.current;
    return getFloatingRects(doc).find((f) => f.panelId === panelId)?.rect ?? getLayout(doc).rects.get(panelId);
  };

  const computeDisplayDoc = (lift: LiftState, original: LayoutDocument): LayoutDocument => {
    if (!lift.collapsed) {
      return original;
    }
    const target = lift.current;
    if (!target || target.kind === 'tab' || target.kind === 'float') {
      return lift.base;
    }
    return applyDrop(lift.base, createDropSlot(), target);
  };

  const publish = useCallback(() => {
    const session = sessionRef.current;
    if (!session) {
      setView(null);
      return;
    }
    if (session.mode === 'reorder' && session.reorder && session.source.kind === 'view') {
      const { tabs, origIndex, index } = session.reorder;
      const dragged = tabs[origIndex];
      const slotWidth = (tabs[origIndex + 1]?.left ?? dragged.left + dragged.width + 2) - dragged.left;
      const others = tabs.filter((_, i) => i !== origIndex);
      const shifts: Record<string, number> = {};
      others.forEach((tab, m) => {
        const k = m < origIndex ? m : m + 1;
        const f = m < index ? m : m + 1;
        shifts[tab.id] = f < k ? -slotWidth : f > k ? slotWidth : 0;
      });
      setView({
        displayDoc: session.original,
        target: null,
        dropKind: 'none',
        reorder: {
          panelId: session.source.panelId,
          viewId: session.source.viewId,
          offsetX: session.pointer.x - session.start.x,
          shifts,
        },
      });
      return;
    }
    const lift = session.lift;
    if (session.mode !== 'lift' || !lift) {
      return;
    }
    const target = lift.current;
    const dropKind: DropKind = !target
      ? lift.isFloatMove
        ? 'float'
        : 'none'
      : target.kind === 'tab'
        ? 'tab'
        : target.kind === 'float'
          ? 'float'
          : 'dock';
    setView({
      displayDoc: lift.displayDoc,
      lifted: { panel: lift.payload, rect: lift.rect, region: lift.region },
      hiddenPanelId: !lift.collapsed && session.source.kind === 'panel' ? session.source.panelId : undefined,
      sourceSlotRect:
        !lift.collapsed && session.source.kind === 'panel' && !lift.isFloatMove ? lift.startRect : undefined,
      target,
      dropKind,
      tabGap:
        target?.kind === 'tab' ? { panelId: target.panelId, index: target.index, width: lift.tabWidth } : undefined,
    });
  }, []);

  const updateLiftedRect = (session: Session, now: number): boolean => {
    const lift = session.lift!;
    const start = lift.startRect;
    const overOrigin =
      !lift.compactOnly && !lift.collapsed && rectContains(start, session.pointer.x, session.pointer.y);
    const wanted = lift.isFloatMove || overOrigin ? { w: start.w, h: start.h } : compactSize(start);
    if (!sameSize(wanted, lift.sizeTo)) {
      lift.sizeFrom = lift.size;
      lift.sizeTo = wanted;
      lift.sizeStart = now;
    }
    const t = Math.min(1, (now - lift.sizeStart) / MOTION.lift);
    const e = easeOut(t);
    lift.size = {
      w: lift.sizeFrom.w + (lift.sizeTo.w - lift.sizeFrom.w) * e,
      h: lift.sizeFrom.h + (lift.sizeTo.h - lift.sizeFrom.h) * e,
    };
    // Keep the grabbed point under the pointer: horizontally in proportion, vertically within the tab bar.
    lift.rect = {
      x: session.pointer.x - lift.grab.x * (lift.size.w / start.w),
      y: session.pointer.y - lift.grab.y,
      w: lift.size.w,
      h: lift.size.h,
    };
    return t < 1;
  };

  const settle = useCallback(() => {
    const session = sessionRef.current;
    const lift = session?.lift;
    if (!session || !lift || lift.pending === undefined) {
      return;
    }
    lift.current = lift.pending;
    lift.pending = undefined;
    if (lift.current) {
      lift.collapsed = true;
    }
    lift.displayDoc = computeDisplayDoc(lift, session.original);
    publish();
  }, [publish]);

  const hitTestLift = (session: Session) => {
    const lift = session.lift!;
    const { metrics, getViewport, getLayout, getFloatingRects, getFramedId } = optionsRef.current;
    const viewport = getViewport();
    const displayDoc = lift.displayDoc;
    const layout = getLayout(displayDoc);
    const { x, y } = session.pointer;

    let result: DropTarget | null = null;
    const current = lift.current;
    // A dock slot displaces its neighbours, so while the pointer is inside it the target holds.
    const slotRect =
      current && current.kind !== 'float' && current.kind !== 'tab' ? layout.rects.get(DROP_SLOT_ID) : undefined;
    if (current && slotRect && rectContains(insetRect(slotRect, -metrics.gap), x, y)) {
      result = current;
    } else {
      const hit = hitTest({
        point: session.pointer,
        viewport,
        doc: displayDoc,
        layout,
        floating: getFloatingRects(displayDoc).filter((f) => f.panelId !== lift.payload.id),
        metrics,
        selfPanelId:
          !lift.collapsed && session.source.kind === 'panel' && session.source.region === 'docked'
            ? session.source.panelId
            : undefined,
        movingFloatId: lift.isFloatMove ? lift.payload.id : undefined,
        tabIndexAt,
      });
      result = hit === 'self' ? null : hit;
    }

    const framedId = getFramedId();
    if (result?.kind === 'frame' && framedId && findNode(displayDoc.root, framedId)) {
      result = { kind: 'edge', panelId: framedId, side: result.side };
    }
    if (!result && lift.isFloatMove && rectContains(viewport, x, y)) {
      result = { kind: 'float', rect: toFraction(lift.rect, viewport) };
    }
    if (result?.kind === 'float') {
      result = { kind: 'float', rect: toFraction(lift.rect, viewport) };
    }
    lift.candidate = result;

    const key = targetKey(result);
    if (key === targetKey(lift.current)) {
      if (lift.pending !== undefined) {
        clearTimeout(lift.settleTimer);
        lift.pending = undefined;
      }
      if (result && current && JSON.stringify(result) !== JSON.stringify(current)) {
        // Same target with a new index or rect: no need to wait for it to settle.
        lift.current = result;
        lift.displayDoc = computeDisplayDoc(lift, session.original);
      }
      return;
    }
    if (lift.pending === undefined || key !== targetKey(lift.pending)) {
      clearTimeout(lift.settleTimer);
      lift.pending = result;
      lift.settleTimer = setTimeout(settle, MOTION.settle);
    } else {
      lift.pending = result;
    }
  };

  const tick = useCallback(() => {
    frameRef.current = null;
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    let animating = false;
    if (session.mode === 'lift' && session.lift) {
      animating = updateLiftedRect(session, performance.now());
      hitTestLift(session);
    }
    publish();
    if (animating) {
      frameRef.current = requestAnimationFrame(tick);
    }
    // updateLiftedRect and hitTestLift only read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publish]);

  const schedule = useCallback(() => {
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const beginLift = (session: Session, source: Source, compactOnly: boolean) => {
    const { original } = session;
    const { getViewport } = optionsRef.current;
    let base: LayoutDocument;
    let payload: PanelNode;
    let startRect: Rect | undefined;
    let grab: Point;
    const isFloatMove = source.region === 'floating' && source.kind === 'panel';

    if (source.kind === 'panel') {
      const location = locatePanel(original, source.panelId);
      if (!location) {
        return;
      }
      payload = location.panel;
      base = detachPanel(original, source.panelId);
      startRect = rectOfPanel(original, source.panelId);
      if (!startRect) {
        return;
      }
      grab = { x: session.start.x - startRect.x, y: session.start.y - startRect.y };
    } else {
      payload = { kind: 'panel', id: createId('panel'), views: [source.viewId], selected: source.viewId };
      base = detachView(original, source.viewId);
      const panelRect = rectOfPanel(original, source.panelId);
      if (!panelRect) {
        return;
      }
      startRect = panelRect;
      grab = { x: 40, y: optionsRef.current.metrics.tabBarHeight / 2 };
    }

    const sourceTab = optionsRef.current.rootRef.current?.querySelector<HTMLElement>(
      `[data-tiling-tab="${CSS.escape(payload.selected)}"]`
    );
    const initialSize = compactOnly ? compactSize(startRect) : { w: startRect.w, h: startRect.h };
    const lift: LiftState = {
      base,
      payload,
      region: source.region,
      startRect,
      grab,
      compactOnly,
      isFloatMove,
      size: initialSize,
      sizeFrom: initialSize,
      sizeTo: initialSize,
      sizeStart: performance.now(),
      rect: { ...startRect, ...initialSize },
      collapsed: source.kind === 'view' || source.region === 'floating',
      candidate: null,
      pending: undefined,
      current: null,
      displayDoc: original,
      tabWidth: sourceTab?.offsetWidth ?? 100,
    };
    lift.displayDoc = computeDisplayDoc(lift, original);
    session.mode = 'lift';
    session.lift = lift;
    if (isFloatMove) {
      lift.current = { kind: 'float', rect: toFraction(startRect, getViewport()) };
    }
    updateLiftedRect(session, performance.now());
  };

  const beginReorder = (session: Session, source: Extract<Source, { kind: 'view' }>): boolean => {
    const strip = queryStrip(source.panelId);
    const tabBar = strip?.closest<HTMLElement>('[data-tiling-tabbar]');
    if (!strip || !tabBar) {
      return false;
    }
    const tabs: TabMeasure[] = [];
    strip.querySelectorAll<HTMLElement>('[data-tiling-tab]').forEach((el) => {
      tabs.push({ id: el.dataset.tilingTab!, left: el.offsetLeft, width: el.offsetWidth });
    });
    const origIndex = tabs.findIndex((t) => t.id === source.viewId);
    const barRect = tabBar.getBoundingClientRect();
    const panelRect = rectOfPanel(session.original, source.panelId);
    if (origIndex < 0 || !panelRect) {
      return false;
    }
    session.mode = 'reorder';
    session.reorder = {
      tabs,
      origIndex,
      index: origIndex,
      tabBarRect: {
        x: barRect.left - session.rootRect.left,
        y: barRect.top - session.rootRect.top,
        w: barRect.width,
        h: barRect.height,
      },
      panelRect,
    };
    return true;
  };

  const updateReorder = (session: Session) => {
    const r = session.reorder!;
    const bar = r.tabBarRect;
    const { x, y } = session.pointer;
    const outside =
      y < bar.y - TEAR_OUT_TOLERANCE ||
      y > bar.y + bar.h + TEAR_OUT_TOLERANCE ||
      x < r.panelRect.x ||
      x > r.panelRect.x + r.panelRect.w;
    if (outside && session.source.kind === 'view') {
      session.reorder = undefined;
      beginLift(session, session.source, true);
      return;
    }
    const dragged = r.tabs[r.origIndex];
    const center = dragged.left + dragged.width / 2 + (x - session.start.x);
    const others = r.tabs.filter((_, i) => i !== r.origIndex);
    r.index = others.filter((t) => t.left + t.width / 2 < center).length;
  };

  const cleanup = useCallback(() => {
    const session = sessionRef.current;
    if (session?.lift?.settleTimer) {
      clearTimeout(session.lift.settleTimer);
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    sessionRef.current = null;
    listenersRef.current?.();
    listenersRef.current = null;
    setView(null);
  }, []);

  const finish = useCallback(
    (cancelled: boolean) => {
      const session = sessionRef.current;
      if (!session) {
        return;
      }
      const { onCommit, getViewport } = optionsRef.current;
      if (!cancelled && session.mode === 'reorder' && session.reorder && session.source.kind === 'view') {
        const { index, origIndex } = session.reorder;
        if (index !== origIndex) {
          const doc = selectView(moveTab(session.original, session.source.viewId, index), session.source.viewId);
          onCommit({ doc, panelId: session.source.panelId, focusViewId: session.source.viewId, announce: false });
        }
      } else if (!cancelled && session.mode === 'lift' && session.lift) {
        const lift = session.lift;
        updateLiftedRect(session, performance.now() + MOTION.lift);
        hitTestLift(session);
        let target = lift.candidate;
        if (target?.kind === 'float') {
          target = { kind: 'float', rect: toFraction(lift.rect, getViewport()) };
        }
        if (target) {
          const doc = applyDrop(lift.base, lift.payload, target);
          const panelId = target.kind === 'tab' ? target.panelId : lift.payload.id;
          onCommit({ doc, panelId, focusViewId: lift.payload.selected, announce: true });
        }
      }
      cleanup();
    },
    // hitTestLift and updateLiftedRect only read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cleanup]
  );

  const startSession = useCallback(
    (e: React.PointerEvent, source: Source) => {
      const root = optionsRef.current.rootRef.current;
      if (e.button !== 0 || hasModifier(e) || !root || sessionRef.current) {
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const start = { x: e.clientX - rootRect.left, y: e.clientY - rootRect.top };
      const session: Session = {
        pointerId: e.pointerId,
        start,
        pointer: start,
        rootRect,
        source,
        original: optionsRef.current.getDoc(),
        mode: 'pending',
      };
      sessionRef.current = session;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== session.pointerId || sessionRef.current !== session) {
          return;
        }
        session.pointer = toLocal(session, ev);
        if (session.mode === 'pending') {
          const dx = session.pointer.x - session.start.x;
          const dy = session.pointer.y - session.start.y;
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
            return;
          }
          // Content must not swallow the pointer while dragging.
          window.getSelection()?.removeAllRanges();
          optionsRef.current.onDragStart?.();
          const location = locatePanel(session.original, source.panelId);
          if (source.kind === 'view' && location && location.panel.views.length > 1) {
            if (!beginReorder(session, source)) {
              beginLift(session, source, true);
            }
          } else {
            // A lone tab moves its whole panel.
            session.source = { kind: 'panel', panelId: source.panelId, region: source.region };
            beginLift(session, session.source, false);
          }
        }
        if (session.mode === 'reorder') {
          updateReorder(session);
        }
        ev.preventDefault();
        schedule();
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId === session.pointerId) {
          if (session.mode === 'pending') {
            cleanup();
          } else {
            finish(false);
          }
        }
      };
      const onCancel = () => finish(true);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape' && session.mode !== 'pending') {
          ev.preventDefault();
          ev.stopPropagation();
          finish(true);
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('blur', onCancel);
      window.addEventListener('keydown', onKey, true);
      listenersRef.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('blur', onCancel);
        window.removeEventListener('keydown', onKey, true);
      };
    },
    // beginLift, beginReorder and updateReorder only read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cleanup, finish, schedule]
  );

  useEffect(() => () => cleanup(), [cleanup]);

  const onTabPointerDown = useCallback(
    (e: React.PointerEvent, panelId: string, viewId: string, region: PanelRegion) => {
      startSession(e, { kind: 'view', viewId, panelId, region });
    },
    [startSession]
  );

  const onPanelPointerDown = useCallback(
    (e: React.PointerEvent, panelId: string, region: PanelRegion) => {
      startSession(e, { kind: 'panel', panelId, region });
    },
    [startSession]
  );

  return { drag: view, onTabPointerDown, onPanelPointerDown, cancel: () => finish(true) };
}

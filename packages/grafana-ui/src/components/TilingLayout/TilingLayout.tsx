import { cx } from '@emotion/css';
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type * as React from 'react';

import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { ContextMenu } from '../ContextMenu/ContextMenu';

import { Divider } from './Divider';
import { FloatResizeHandles } from './FloatResizeHandles';
import { PanelFrame } from './PanelFrame';
import { ViewSurface } from './ViewSurface';
import { TilingLayoutContext } from './context';
import { type ResizeDirection, TilingInternalContext, type TilingInternals } from './internalContext';
import {
  closeView as closeViewInDoc,
  dockFloating,
  emptyDocument,
  floatPanel as floatPanelInDoc,
  hide as hideInDoc,
  locatePanel,
  locateView,
  openView as openViewInDoc,
  raiseFloating,
  resolvePanel,
  restore as restoreInDoc,
  sanitizeDocument,
  selectView as selectViewInDoc,
  setFloatingRect,
} from './model/document';
import { type FloatingHitRect } from './model/hitTest';
import { type ComputedLayout, computeFramedLayout, insetRect, type Seam } from './model/layout';
import { evenSplit, resizeSplit } from './model/resize';
import { containsNode, DROP_SLOT_ID, findNode, findParent, listPanels } from './model/tree';
import {
  type LayoutDocument,
  type LayoutNode,
  type PanelNode,
  type PanelRegion,
  type Rect,
  type ViewParams,
} from './model/types';
import { buildPanelMenu, renderTilingMenuEntries, tidyMenuEntries } from './panelMenu';
import { getMetrics, getStyles, MOTION } from './styles';
import {
  type RenderView,
  type TilingLayoutApi,
  type TilingLayoutContextValue,
  type TilingMenuEntry,
  type TilingPanelInfo,
  type TilingPanelMenuRenderProps,
  type TilingTabRenderProps,
  type TilingViewApi,
  type TilingViewInfo,
} from './types';
import { type DropCommit, useDragController } from './useDragController';

export interface TilingLayoutProps {
  /** The controlled layout. Pair it with `onLayoutChange`. */
  layout?: LayoutDocument;
  /** The initial layout when uncontrolled. Build one with `createTilingDocument`. */
  defaultLayout?: LayoutDocument;
  /** Called with every committed change: drops, resizes, closes, tab selection and so on. */
  onLayoutChange?: (doc: LayoutDocument) => void;
  /** Renders a view's content. Called once per view and kept mounted while the view moves around. */
  renderView: RenderView;
  /** Renders the content of a tab. Use `TilingTab` to keep the default look while adding your own parts. */
  renderTab?: (props: TilingTabRenderProps) => ReactNode;
  /** Extra content at the end of each tab bar, before the menu button, such as action buttons. */
  renderTabBarActions?: (panel: TilingPanelInfo) => ReactNode;
  /** The tab title of a view. Defaults to its record's title, then its id. */
  getViewTitle?: (id: string, record: LayoutDocument['views'][string]) => string;
  /** Whether a view can be closed. Defaults to true. */
  isViewClosable?: (view: TilingViewInfo) => boolean;
  /** Edits a panel's menu: receives the built-in entries and returns the entries to show. */
  getPanelMenu?: (entries: TilingMenuEntry[], panel: TilingPanelInfo) => TilingMenuEntry[];
  /** Renders the items of a panel's menu yourself, e.g. with `Menu.Item`s or `renderTilingMenuEntries`. */
  renderPanelMenu?: (props: TilingPanelMenuRenderProps) => ReactNode;
  /** Return (or resolve) false to keep a view open. Not consulted for forced closes. */
  onBeforeViewClose?: (view: TilingViewInfo) => boolean | Promise<boolean>;
  onViewClose?: (view: TilingViewInfo) => void;
  onFocusChange?: (viewId: string | null) => void;
  onMaximizeChange?: (nodeId: string | null) => void;
  /** Allows maximizing panels by double-clicking a tab bar, the menu or the keyboard. Defaults to true. */
  maximize?: boolean;
  /** Allows floating panels. Defaults to true. */
  floating?: boolean;
  /**
   * Whether panels pushed by a divider stay pushed when it's dragged back. `false` makes each drag work
   * from the layout it started with, so dragging back undoes the pushes. Defaults to true.
   */
  keepPushed?: boolean;
  /** Shown when the layout has no panels. */
  emptyState?: ReactNode;
  /** Rendered in a full-size layer above the layout, for docks, toolbars and other chrome. */
  children?: ReactNode;
  className?: string;
  'aria-label'?: string;
  ref?: Ref<TilingLayoutApi>;
}

interface FramePlacement {
  panel: TilingPanelInfo;
  rect: Rect;
  z: number;
  lifted: boolean;
}

interface ViewPlacement {
  rect: Rect;
  z: number;
  visible: boolean;
  lifted: boolean;
}

interface ResizeSession {
  seam: Seam;
  /** Offset from the pointer to the divider's position along its axis. */
  grab: number;
  startPointer: number;
  startRoot: LayoutNode;
  root: LayoutNode;
}

const FLOAT_MIN_WIDTH = 160;
const FLOAT_NUDGE = 24;
const FLOAT_DEFAULT_MAX = { w: 560, h: 400 };
const Z = { docked: 1, divider: 50, slot: 60, floatBase: 100, settling: 900, lifted: 1000, chrome: 2000 };

function sameArray(a: unknown[], b: unknown[]) {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

/** Returns a cached object while its signature is unchanged, so memoized parts don't re-render. */
function useSignatureCache<T>() {
  const cache = useRef(new Map<string, { sig: unknown[]; value: T }>());
  return useCallback((key: string, sig: unknown[], create: () => T): T => {
    const hit = cache.current.get(key);
    if (hit && sameArray(hit.sig, sig)) {
      return hit.value;
    }
    const value = create();
    cache.current.set(key, { sig, value });
    return value;
  }, []);
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

function isModKey(e: React.KeyboardEvent) {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? e.metaKey : e.ctrlKey;
}

/**
 * A tiling layout: panels of tabbed views that users split, tab, float, hide and maximize by dragging tabs
 * and tab bars, or from each panel's menu. View content stays mounted through every rearrangement.
 *
 * The layout is a serializable `LayoutDocument`, controlled through `layout`/`onLayoutChange` or
 * uncontrolled with `defaultLayout`. Content renders through `renderView`; tabs, tab bar actions and menus
 * can be customized with render props, and anything inside can use `useTilingLayout` and `useTilingView`.
 */
export function TilingLayout(props: TilingLayoutProps) {
  const {
    layout: controlledDoc,
    defaultLayout,
    renderView,
    renderTab,
    renderTabBarActions,
    maximize: maximizeEnabled = true,
    floating: floatingEnabled = true,
    emptyState,
    children,
    className,
    ref,
  } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const metrics = useMemo(() => getMetrics(theme), [theme]);
  const rootId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const propsRef = useLatest(props);

  // Document state, controlled or uncontrolled.
  const [internalDoc, setInternalDoc] = useState(() => sanitizeDocument(defaultLayout ?? emptyDocument()));
  const sanitizedControlled = useMemo(
    () => (controlledDoc ? sanitizeDocument(controlledDoc) : undefined),
    [controlledDoc]
  );
  const doc = sanitizedControlled ?? internalDoc;
  const docRef = useRef(doc);
  docRef.current = doc;
  const commit = useCallback(
    (next: LayoutDocument) => {
      if (next === docRef.current) {
        return;
      }
      docRef.current = next;
      if (!propsRef.current.layout) {
        setInternalDoc(next);
      }
      propsRef.current.onLayoutChange?.(next);
    },
    [propsRef]
  );

  // UI state.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [focusedViewId, setFocusedViewId] = useState<string | null>(null);
  const [framedId, setFramedId] = useState<string | null>(null);
  const restoreFrameRef = useRef<string | null>(null);
  const [cameraMoving, setCameraMoving] = useState(false);
  const [resize, setResize] = useState<ResizeSession | null>(null);
  const [floatResize, setFloatResize] = useState<{ panelId: string; rect: Rect } | null>(null);
  const [menu, setMenu] = useState<{ panelId: string; x: number; y: number; anchor?: HTMLElement } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [settlingPanelId, setSettlingPanelId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const viewport: Rect = useMemo(() => ({ x: 0, y: 0, w: size.w, h: size.h }), [size]);
  const bounds = useMemo(() => insetRect(viewport, metrics.gap), [viewport, metrics.gap]);
  const effectiveFramed = framedId && findNode(doc.root, framedId) ? framedId : null;
  const framedRef = useLatest(effectiveFramed);
  const focusedRef = useLatest(focusedViewId);
  const viewportRef = useLatest(viewport);

  const getLayout = useCallback(
    (d: LayoutDocument): ComputedLayout => computeFramedLayout(d.root, bounds, metrics, framedRef.current),
    [bounds, metrics, framedRef]
  );
  const toPx = useCallback(
    (r: Rect): Rect => ({
      x: Math.round(r.x * viewport.w),
      y: Math.round(r.y * viewport.h),
      w: Math.round(r.w * viewport.w),
      h: Math.round(r.h * viewport.h),
    }),
    [viewport]
  );
  const toFraction = useCallback(
    (r: Rect): Rect => ({ x: r.x / viewport.w, y: r.y / viewport.h, w: r.w / viewport.w, h: r.h / viewport.h }),
    [viewport]
  );
  const getFloatingRects = useCallback(
    (d: LayoutDocument): FloatingHitRect[] =>
      d.floating.map((f) => ({ panelId: f.panel.id, rect: toPx(f.rect), z: f.z })),
    [toPx]
  );

  const setFocus = useCallback(
    (viewId: string | null) => {
      setFocusedViewId((prev) => {
        if (prev !== viewId) {
          propsRef.current.onFocusChange?.(viewId);
        }
        return viewId;
      });
    },
    [propsRef]
  );

  const setFramed = useCallback(
    (id: string | null) => {
      setFramedId((prev) => {
        if (prev !== id) {
          propsRef.current.onMaximizeChange?.(id);
        }
        return id;
      });
      setCameraMoving(true);
    },
    [propsRef]
  );

  useEffect(() => {
    if (!cameraMoving) {
      return;
    }
    const timer = setTimeout(() => setCameraMoving(false), MOTION.camera + 50);
    return () => clearTimeout(timer);
  }, [cameraMoving, framedId]);

  /** Zooms out when a panel lands outside the maximized node, so it stays in view. */
  const widenFrameFor = useCallback(
    (d: LayoutDocument, panelId: string) => {
      const framed = framedRef.current;
      if (!framed) {
        return;
      }
      const framedNode = findNode(d.root, framed);
      const isDocked = findNode(d.root, panelId) !== undefined;
      if (isDocked && (!framedNode || !containsNode(framedNode, panelId))) {
        restoreFrameRef.current = null;
        setFramed(null);
      }
    },
    [framedRef, setFramed]
  );

  // Imperative API.
  const api: TilingLayoutApi = useMemo(() => {
    const titleOf = (id: string) => {
      const record = docRef.current.views[id];
      return propsRef.current.getViewTitle?.(id, record) ?? record?.title ?? id;
    };
    const infoOf = (id: string): TilingViewInfo => {
      const record = docRef.current.views[id] ?? {};
      const location = locateView(docRef.current, id);
      return {
        id,
        title: titleOf(id),
        type: record.type,
        params: record.params ?? {},
        panelId: location?.panel.id ?? null,
        region: location?.region ?? null,
        selected: location?.panel.selected === id,
        focused: false,
      };
    };

    const focusView = (id: string) => {
      let d = docRef.current;
      let location = locateView(d, id);
      if (!location) {
        return;
      }
      if (location.region === 'hidden') {
        d = restoreInDoc(d, location.panel.id);
        location = locateView(d, id);
      }
      d = selectViewInDoc(d, id);
      if (location?.region === 'floating') {
        d = raiseFloating(d, location.panel.id);
      }
      commit(d);
      setFocus(id);
      if (location) {
        widenFrameFor(d, location.panel.id);
      }
    };

    const toggleMaximize = (id?: string): boolean => {
      if (!propsRef.current.maximize && propsRef.current.maximize !== undefined) {
        return false;
      }
      const target = id ?? focusedRef.current;
      const location = target ? resolvePanel(docRef.current, target) : undefined;
      if (!location || location.region !== 'docked') {
        return false;
      }
      const panelId = location.panel.id;
      if (framedRef.current === panelId) {
        const back = restoreFrameRef.current;
        restoreFrameRef.current = null;
        setFramed(back && findNode(docRef.current.root, back) ? back : null);
      } else {
        restoreFrameRef.current = framedRef.current;
        setFramed(panelId);
      }
      return true;
    };

    return {
      getDocument: () => docRef.current,
      update: (fn) => commit(fn(docRef.current)),
      openView: (id, record, placement) => {
        const next = openViewInDoc(docRef.current, id, record, placement);
        commit(next);
        setFocus(id);
        const location = locateView(next, id);
        if (location) {
          widenFrameFor(next, location.panel.id);
        }
      },
      closeView: async (id, options) => {
        if (!docRef.current.views[id]) {
          return false;
        }
        const info = infoOf(id);
        const guard = propsRef.current.onBeforeViewClose;
        if (!options?.force && guard && !(await guard(info))) {
          return false;
        }
        const before = locateView(docRef.current, id);
        const next = closeViewInDoc(docRef.current, id);
        commit(next);
        propsRef.current.onViewClose?.(info);
        if (focusedRef.current === id) {
          const panel = before ? locatePanel(next, before.panel.id) : undefined;
          setFocus(panel?.panel.selected ?? null);
        }
        return true;
      },
      selectView: (id) => commit(selectViewInDoc(docRef.current, id)),
      focusView,
      floatPanel: (id, rect) => {
        if (propsRef.current.floating === false) {
          return;
        }
        const location = resolvePanel(docRef.current, id);
        if (!location) {
          return;
        }
        let target = rect;
        if (!target) {
          const current =
            getFloatingRects(docRef.current).find((f) => f.panelId === location.panel.id)?.rect ??
            getLayout(docRef.current).rects.get(location.panel.id);
          const w = Math.min(current?.w ?? FLOAT_DEFAULT_MAX.w, FLOAT_DEFAULT_MAX.w);
          const h = Math.min(current?.h ?? FLOAT_DEFAULT_MAX.h, FLOAT_DEFAULT_MAX.h);
          const { w: vw, h: vh } = viewportRef.current;
          // Nudged toward the middle so the float reads as lifted off the layout.
          const cx = current
            ? current.x + current.w / 2 + Math.sign(vw / 2 - (current.x + current.w / 2)) * FLOAT_NUDGE
            : vw / 2;
          const cy = current
            ? current.y + current.h / 2 + Math.sign(vh / 2 - (current.y + current.h / 2)) * FLOAT_NUDGE
            : vh / 2;
          const x = Math.max(0, Math.min(cx - w / 2, viewportRef.current.w - w));
          const y = Math.max(0, Math.min(cy - h / 2, viewportRef.current.h - h));
          target = toFraction({ x, y, w, h });
        }
        commit(floatPanelInDoc(docRef.current, id, target));
      },
      dockPanel: (panelId) => commit(dockFloating(docRef.current, panelId)),
      hide: (id) => commit(hideInDoc(docRef.current, id)),
      restore: (panelId) => {
        const entry = docRef.current.hidden.find((h) => h.panel.id === panelId);
        const next = restoreInDoc(docRef.current, panelId);
        commit(next);
        if (entry) {
          setFocus(entry.panel.selected);
          widenFrameFor(next, panelId);
        }
      },
      toggleMaximize,
      stepOut: () => {
        const framed = framedRef.current;
        if (!framed) {
          return;
        }
        restoreFrameRef.current = null;
        const parent = findParent(docRef.current.root, framed)?.parent;
        setFramed(parent && parent.id !== docRef.current.root?.id ? parent.id : null);
      },
      setViewTitle: (id, title) => {
        const record = docRef.current.views[id];
        if (record && record.title !== title) {
          commit({ ...docRef.current, views: { ...docRef.current.views, [id]: { ...record, title } } });
        }
      },
      setViewParams: (id, params: ViewParams) => {
        const record = docRef.current.views[id];
        if (record) {
          commit({ ...docRef.current, views: { ...docRef.current.views, [id]: { ...record, params } } });
        }
      },
    };
    // Everything read here goes through refs, so the API object stays stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, setFocus, setFramed, widenFrameFor, getLayout, getFloatingRects, toFraction]);

  useImperativeHandle(ref, () => api, [api]);

  // Drag and drop.
  const onDropCommit = useCallback(
    ({ doc: next, panelId, focusViewId, announce }: DropCommit) => {
      commit(next);
      setFocus(focusViewId);
      setSettlingPanelId(panelId);
      if (announce) {
        setAnnouncement(t('grafana-ui.tiling-layout.moved', 'Moved'));
      }
      widenFrameFor(next, panelId);
    },
    [commit, setFocus, widenFrameFor]
  );

  useEffect(() => {
    if (!announcement) {
      return;
    }
    const timer = setTimeout(() => setAnnouncement(''), 1000);
    return () => clearTimeout(timer);
  }, [announcement]);

  useEffect(() => {
    if (!settlingPanelId) {
      return;
    }
    const timer = setTimeout(() => setSettlingPanelId(null), MOTION.layout + 60);
    return () => clearTimeout(timer);
  }, [settlingPanelId]);

  const { drag, onTabPointerDown, onPanelPointerDown } = useDragController({
    rootRef,
    metrics,
    getDoc: () => docRef.current,
    getViewport: () => viewportRef.current,
    getLayout,
    getFloatingRects,
    getFramedId: () => framedRef.current,
    onCommit: onDropCommit,
    onDragStart: () => setMenu(null),
  });

  // Divider resizing.
  const onResizeStart = useCallback(
    (e: React.PointerEvent, seam: Seam) => {
      const root = docRef.current.root;
      if (e.button !== 0 || !root) {
        return;
      }
      e.preventDefault();
      const axisPos = (ev: { clientX: number; clientY: number }) => {
        const r = rootRef.current!.getBoundingClientRect();
        return seam.axis === 'x' ? ev.clientX - r.left : ev.clientY - r.top;
      };
      const seamPos = (s: Seam) => (s.axis === 'x' ? s.rect.x : s.rect.y);
      const start = axisPos(e);
      const session: ResizeSession = { seam, grab: start - seamPos(seam), startPointer: start, startRoot: root, root };
      setResize(session);

      const onMove = (ev: PointerEvent) => {
        const pos = axisPos(ev);
        if (propsRef.current.keepPushed === false) {
          const startLayout = getLayout({ ...docRef.current, root: session.startRoot });
          session.root = resizeSplit(
            session.startRoot,
            startLayout,
            metrics,
            seam.splitId,
            seam.index,
            pos - session.startPointer
          );
        } else {
          const layout = getLayout({ ...docRef.current, root: session.root });
          const current = layout.seams.find((s) => s.splitId === seam.splitId && s.index === seam.index);
          if (!current) {
            return;
          }
          const delta = pos - session.grab - seamPos(current);
          session.root = resizeSplit(session.root, layout, metrics, seam.splitId, seam.index, delta);
        }
        setResize({ ...session });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        commit({ ...docRef.current, root: session.root });
        setResize(null);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [commit, getLayout, metrics, propsRef]
  );

  const onResizeBy = useCallback(
    (seam: Seam, delta: number) => {
      const d = docRef.current;
      if (d.root) {
        commit({ ...d, root: resizeSplit(d.root, getLayout(d), metrics, seam.splitId, seam.index, delta) });
      }
    },
    [commit, getLayout, metrics]
  );

  const onEven = useCallback(
    (seam: Seam) => {
      const d = docRef.current;
      if (d.root) {
        commit({ ...d, root: evenSplit(d.root, seam.splitId, seam.index) });
      }
    },
    [commit]
  );

  // Floating panel resizing.
  const onFloatResizeStart = useCallback(
    (e: React.PointerEvent, panelId: string, dir: ResizeDirection) => {
      const entry = docRef.current.floating.find((f) => f.panel.id === panelId);
      if (e.button !== 0 || !entry) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const startRect = toPx(entry.rect);
      const sx = e.clientX;
      const sy = e.clientY;
      const minH = metrics.tabBarHeight + 40;
      let rect = startRect;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - sx;
        const dy = ev.clientY - sy;
        let { x, y, w, h } = startRect;
        if (dir.includes('e')) {
          w = Math.max(FLOAT_MIN_WIDTH, startRect.w + dx);
        }
        if (dir.includes('s')) {
          h = Math.max(minH, startRect.h + dy);
        }
        if (dir.includes('w')) {
          w = Math.max(FLOAT_MIN_WIDTH, startRect.w - dx);
          x = startRect.x + startRect.w - w;
        }
        if (dir.includes('n')) {
          h = Math.max(minH, startRect.h - dy);
          y = startRect.y + startRect.h - h;
        }
        rect = { x, y, w, h };
        setFloatResize({ panelId, rect: toFraction(rect) });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        commit(setFloatingRect(docRef.current, panelId, toFraction(rect)));
        setFloatResize(null);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [commit, metrics.tabBarHeight, toFraction, toPx]
  );

  // What to draw.
  let displayDoc = drag?.displayDoc ?? doc;
  if (!drag && resize) {
    displayDoc = { ...displayDoc, root: resize.root };
  }
  if (!drag && floatResize) {
    displayDoc = setFloatingRect(displayDoc, floatResize.panelId, floatResize.rect);
  }
  const layout = useMemo(
    () => computeFramedLayout(displayDoc.root, bounds, metrics, effectiveFramed),
    [displayDoc.root, bounds, metrics, effectiveFramed]
  );
  const cache = useSignatureCache<TilingViewInfo | TilingPanelInfo | TilingViewApi>();

  const titleOf = (id: string) => {
    const record = displayDoc.views[id];
    return props.getViewTitle?.(id, record) ?? record?.title ?? id;
  };

  const viewInfo = (id: string, panel: PanelNode, region: PanelRegion): TilingViewInfo => {
    const record = displayDoc.views[id] ?? {};
    const title = titleOf(id);
    const selected = panel.selected === id;
    const focused = focusedViewId === id;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cache(`info:${id}`, [title, record.type, record.params, panel.id, region, selected, focused], () => ({
      id,
      title,
      type: record.type,
      params: record.params ?? {},
      panelId: panel.id,
      region,
      selected,
      focused,
    })) as TilingViewInfo;
  };

  const panelInfo = (panel: PanelNode, region: PanelRegion): TilingPanelInfo => {
    const views = panel.views.map((v) => viewInfo(v, panel, region));
    const selectedView = views.find((v) => v.id === panel.selected) ?? views[0];
    const focused = focusedViewId !== null && panel.views.includes(focusedViewId);
    const maximized = effectiveFramed === panel.id;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cache(`panel:${panel.id}`, [...views, focused, maximized, region], () => ({
      id: panel.id,
      region,
      views,
      selectedView,
      focused,
      maximized,
    })) as TilingPanelInfo;
  };

  const frames: FramePlacement[] = [];
  for (const panel of listPanels(displayDoc.root)) {
    const rect = layout.rects.get(panel.id);
    if (panel.id === DROP_SLOT_ID || panel.id === drag?.hiddenPanelId || !rect) {
      continue;
    }
    const z = panel.id === settlingPanelId ? Z.settling : Z.docked;
    frames.push({ panel: panelInfo(panel, 'docked'), rect, z, lifted: false });
  }
  [...displayDoc.floating]
    .sort((a, b) => a.z - b.z)
    .forEach((f, i) => {
      const z = f.panel.id === settlingPanelId ? Z.settling : Z.floatBase + i * 2;
      frames.push({ panel: panelInfo(f.panel, 'floating'), rect: toPx(f.rect), z, lifted: false });
    });
  if (drag?.lifted) {
    frames.push({
      panel: panelInfo(drag.lifted.panel, drag.lifted.region),
      rect: drag.lifted.rect,
      z: Z.lifted,
      lifted: true,
    });
  }

  const placements = new Map<string, ViewPlacement>();
  for (const frame of frames) {
    const { rect } = frame;
    const content: Rect = {
      x: rect.x + 1,
      y: rect.y + 1 + metrics.tabBarHeight,
      w: Math.max(0, rect.w - 2),
      h: Math.max(0, rect.h - metrics.tabBarHeight - 2),
    };
    for (const v of frame.panel.views) {
      placements.set(v.id, { rect: content, z: frame.z + 1, visible: v.selected, lifted: frame.lifted });
    }
  }

  // Views render in a stable order so the DOM never moves them (which would reload iframes).
  const viewOrderRef = useRef<string[]>([]);
  const lastRectsRef = useRef(new Map<string, Rect>());
  const viewIds = Object.keys(displayDoc.views);
  const known = new Set(viewIds);
  const order = viewOrderRef.current.filter((id) => known.has(id));
  const inOrder = new Set(order);
  viewIds.forEach((id) => !inOrder.has(id) && order.push(id));
  viewOrderRef.current = order;

  const interactionActive = Boolean(drag || resize || floatResize);
  const surfaces = order.map((id) => {
    const placement = placements.get(id);
    const lastRect = lastRectsRef.current.get(id) ?? { x: 0, y: 0, w: 0, h: 0 };
    if (placement) {
      lastRectsRef.current.set(id, placement.rect);
    }
    const location =
      locateView(displayDoc, id) ??
      (drag?.lifted?.panel.views.includes(id) ? { panel: drag.lifted.panel, region: drag.lifted.region } : undefined);
    const info = location ? viewInfo(id, location.panel, location.region) : undefined;
    if (!info) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const viewApi = cache(`api:${id}`, [info], () => ({
      ...info,
      close: () => api.closeView(id),
      hide: () => api.hide(id),
      focus: () => api.focusView(id),
      setTitle: (title: string) => api.setViewTitle(id, title),
      setParams: (params: ViewParams) => api.setViewParams(id, params),
      toggleMaximize: () => api.toggleMaximize(id),
    })) as TilingViewApi;
    return (
      <ViewSurface
        key={id}
        view={viewApi}
        rect={placement?.rect ?? lastRect}
        z={placement?.z ?? 0}
        visible={placement?.visible ?? false}
        lifted={placement?.lifted ?? false}
        inert={interactionActive}
        renderView={renderView}
      />
    );
  });

  // Drop previews.
  let slotRect: Rect | undefined;
  let slotKind: 'tab' | 'dock' | undefined;
  if (drag?.target && drag.dropKind === 'tab' && drag.target.kind === 'tab') {
    const targetId = drag.target.panelId;
    slotRect = frames.find((f) => f.panel.id === targetId && !f.lifted)?.rect;
    slotKind = 'tab';
  } else if (drag?.dropKind === 'dock') {
    slotRect = layout.rects.get(DROP_SLOT_ID);
    slotKind = 'dock';
  }
  const slotZ =
    slotKind === 'tab'
      ? (frames.find((f) => f.panel.id === (drag?.target?.kind === 'tab' ? drag.target.panelId : ''))?.z ?? 0) + 2
      : Z.slot;

  // Internals shared with the parts.
  const hasRenderTab = Boolean(renderTab);
  const hasRenderTabBarActions = Boolean(renderTabBarActions);
  const internalsRef = useLatest({ renderTab, renderTabBarActions, isViewClosable: props.isViewClosable });
  const internals: TilingInternals = useMemo(
    () => ({
      rootId,
      styles,
      metrics,
      maximizeEnabled,
      renderTab: hasRenderTab ? (p) => internalsRef.current.renderTab?.(p) : undefined,
      renderTabBarActions: hasRenderTabBarActions ? (p) => internalsRef.current.renderTabBarActions?.(p) : undefined,
      isViewClosable: (view) => internalsRef.current.isViewClosable?.(view) ?? true,
      onTabPointerDown,
      onPanelPointerDown,
      onFloatResizeStart,
      selectView: (viewId, focusTab) => {
        api.selectView(viewId);
        if (focusTab) {
          setFocus(viewId);
          requestAnimationFrame(() =>
            rootRef.current?.querySelector<HTMLElement>(`[data-tiling-tab="${CSS.escape(viewId)}"]`)?.focus()
          );
        }
      },
      focusView: (viewId) => setFocus(viewId),
      focusContent: (viewId) => {
        setFocus(viewId);
        requestAnimationFrame(() => {
          const surface = rootRef.current?.querySelector<HTMLElement>(`[data-tiling-view="${CSS.escape(viewId)}"]`);
          const target =
            surface?.querySelector<HTMLElement>('[autofocus]') ??
            surface?.querySelector<HTMLElement>(
              'iframe, input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])'
            );
          target?.focus();
        });
      },
      closeView: (viewId) => void api.closeView(viewId),
      toggleMaximize: (panelId) => {
        if (maximizeEnabled) {
          api.toggleMaximize(panelId);
        }
      },
      openMenu: (panelId, x, y, anchor) => setMenu({ panelId, x, y, anchor }),
    }),
    // The latest render props and closable check are read from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      rootId,
      styles,
      metrics,
      maximizeEnabled,
      hasRenderTab,
      hasRenderTabBarActions,
      onTabPointerDown,
      onPanelPointerDown,
      onFloatResizeStart,
      api,
      setFocus,
    ]
  );

  // Pointer or keyboard focus anywhere in a panel focuses its view, and raises a float.
  const onPointerDownCapture = (e: React.PointerEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    const viewEl = target?.closest<HTMLElement>('[data-tiling-view]');
    const panelEl = target?.closest<HTMLElement>('[data-tiling-panel]');
    const panelId = viewEl
      ? locateView(docRef.current, viewEl.dataset.tilingView!)?.panel.id
      : panelEl?.dataset.tilingPanel;
    if (!panelId) {
      return;
    }
    const location = locatePanel(docRef.current, panelId);
    if (location?.region === 'floating') {
      commit(raiseFloating(docRef.current, panelId));
    }
    if (viewEl) {
      setFocus(viewEl.dataset.tilingView!);
    }
  };

  const onFocusCapture = (e: React.FocusEvent) => {
    const viewEl = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-tiling-view]') : null;
    if (viewEl?.dataset.tilingView) {
      setFocus(viewEl.dataset.tilingView);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const inContent = e.target instanceof Element && e.target.closest('[data-tiling-view]') !== null;
    const focusedPanel = focusedViewId ? locateView(doc, focusedViewId) : undefined;
    if (e.key === 'Enter' && e.shiftKey && isModKey(e)) {
      if (api.toggleMaximize()) {
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Escape' && effectiveFramed && !inContent && !menu) {
      e.preventDefault();
      api.stepOut();
      return;
    }
    if (e.key === 'F6') {
      const panels = [...listPanels(doc.root), ...doc.floating.map((f) => f.panel)];
      if (!panels.length) {
        return;
      }
      e.preventDefault();
      const index = focusedPanel ? panels.findIndex((p) => p.id === focusedPanel.panel.id) : -1;
      const next = panels[(index + (e.shiftKey ? -1 : 1) + panels.length) % panels.length];
      internals.selectView(next.selected, true);
      return;
    }
    if (isModKey(e) && e.altKey && focusedPanel && focusedViewId) {
      const views = focusedPanel.panel.views;
      const i = views.indexOf(focusedViewId);
      if (e.code === 'KeyW') {
        e.preventDefault();
        void api.closeView(focusedViewId);
      } else if (e.code === 'BracketRight' || e.code === 'BracketLeft') {
        e.preventDefault();
        const step = e.code === 'BracketRight' ? 1 : -1;
        internals.selectView(views[(i + step + views.length) % views.length], true);
      }
    }
  };

  const contextValue: TilingLayoutContextValue = useMemo(
    () => ({ ...api, document: doc, focusedViewId, maximizedId: effectiveFramed }),
    [api, doc, focusedViewId, effectiveFramed]
  );

  // Menu.
  let menuContent: ReactNode = null;
  if (menu) {
    const location = locatePanel(doc, menu.panelId);
    if (location && location.region !== 'hidden') {
      const info = panelInfo(location.panel, location.region);
      const close = () => setMenu(null);
      const builtIn = buildPanelMenu({
        panel: info,
        doc,
        api,
        maximizeEnabled,
        floatingEnabled,
        closable: internals.isViewClosable(info.selectedView),
        titleOf,
      });
      const entries = tidyMenuEntries(props.getPanelMenu ? props.getPanelMenu(builtIn, info) : builtIn);
      if (entries.length) {
        menuContent = (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            onClose={() => {
              close();
              menu.anchor?.focus();
            }}
            renderMenuItems={() =>
              props.renderPanelMenu
                ? props.renderPanelMenu({ panel: info, entries, close })
                : renderTilingMenuEntries(entries, close)
            }
          />
        );
      }
    }
  }

  const dropKind = drag?.dropKind;
  const rootStyle: Record<string, string> = {
    '--tiling-duration': `${cameraMoving ? MOTION.camera : MOTION.layout}ms`,
  };
  const isEmpty = !displayDoc.root && displayDoc.floating.length === 0 && !drag?.lifted;

  return (
    <TilingLayoutContext.Provider value={contextValue}>
      <TilingInternalContext.Provider value={internals}>
        {/* The workspace handles keyboard shortcuts for whatever has focus inside it. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={rootRef}
          role="region"
          aria-label={props['aria-label'] ?? t('grafana-ui.tiling-layout.label', 'Tiling layout')}
          className={cx(styles.root, className)}
          data-dragging={drag ? '' : undefined}
          data-drop={dropKind}
          data-resizing={resize || floatResize ? '' : undefined}
          data-maximized={effectiveFramed ?? undefined}
          style={rootStyle}
          onPointerDownCapture={onPointerDownCapture}
          onFocusCapture={onFocusCapture}
          onKeyDown={onKeyDown}
        >
          {isEmpty && emptyState && <div className={styles.empty}>{emptyState}</div>}
          {drag?.sourceSlotRect && (
            <div
              className={styles.sourceSlot}
              data-tiling-part="source-slot"
              style={{
                left: drag.sourceSlotRect.x,
                top: drag.sourceSlotRect.y,
                width: drag.sourceSlotRect.w,
                height: drag.sourceSlotRect.h,
              }}
            />
          )}
          {frames.map((frame) => (
            <PanelFrame
              key={frame.panel.id}
              panel={frame.panel}
              rect={frame.rect}
              z={frame.z}
              lifted={frame.lifted}
              reorder={drag?.reorder?.panelId === frame.panel.id ? drag.reorder : undefined}
              tabGap={
                drag?.tabGap?.panelId === frame.panel.id && !frame.lifted
                  ? { index: drag.tabGap.index, width: drag.tabGap.width }
                  : undefined
              }
            />
          ))}
          {surfaces}
          {!drag &&
            frames
              .filter((f) => f.panel.region === 'floating' && !f.lifted)
              .map((f) => <FloatResizeHandles key={f.panel.id} panelId={f.panel.id} rect={f.rect} z={f.z + 1} />)}
          {!drag &&
            layout.seams.map((seam) => (
              <Divider
                key={`${seam.splitId}:${seam.index}`}
                seam={seam}
                active={resize?.seam.splitId === seam.splitId && resize.seam.index === seam.index}
                onResizeStart={onResizeStart}
                onResizeBy={onResizeBy}
                onEven={onEven}
              />
            ))}
          {slotRect && (
            <div
              className={styles.slot}
              data-tiling-part="drop-slot"
              data-kind={slotKind}
              style={{ left: slotRect.x, top: slotRect.y, width: slotRect.w, height: slotRect.h, zIndex: slotZ }}
            >
              {slotKind === 'tab' && t('grafana-ui.tiling-layout.add-as-tab', 'Add as tab')}
            </div>
          )}
          {children && <ChromeLayer className={styles.chrome}>{children}</ChromeLayer>}
          <div className={styles.srOnly} aria-live="polite" role="status">
            {announcement}
          </div>
          {menuContent}
        </div>
      </TilingInternalContext.Provider>
    </TilingLayoutContext.Provider>
  );
}

function ChromeLayer({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className={className} style={{ zIndex: Z.chrome }}>
      {children}
    </div>
  );
}

import {
  createId,
  findNode,
  findParent,
  insertAtRootEdge,
  insertBeside,
  listPanels,
  mapPanels,
  normalize,
  removeNode,
} from './tree';
import {
  type FloatingPanel,
  type HiddenPanel,
  type LayoutDocument,
  type PanelNode,
  type PanelRegion,
  type Rect,
  type RestoreTarget,
  type Side,
  type ViewRecord,
} from './types';

export function emptyDocument(): LayoutDocument {
  return { root: null, floating: [], hidden: [], views: {} };
}

export interface PanelLocation {
  panel: PanelNode;
  region: PanelRegion;
}

export function locatePanel(doc: LayoutDocument, panelId: string): PanelLocation | undefined {
  const docked = findNode(doc.root, panelId);
  if (docked?.kind === 'panel') {
    return { panel: docked, region: 'docked' };
  }
  const floating = doc.floating.find((f) => f.panel.id === panelId);
  if (floating) {
    return { panel: floating.panel, region: 'floating' };
  }
  const hidden = doc.hidden.find((h) => h.panel.id === panelId);
  if (hidden) {
    return { panel: hidden.panel, region: 'hidden' };
  }
  return undefined;
}

export function locateView(doc: LayoutDocument, viewId: string): PanelLocation | undefined {
  for (const panel of listPanels(doc.root)) {
    if (panel.views.includes(viewId)) {
      return { panel, region: 'docked' };
    }
  }
  for (const f of doc.floating) {
    if (f.panel.views.includes(viewId)) {
      return { panel: f.panel, region: 'floating' };
    }
  }
  for (const h of doc.hidden) {
    if (h.panel.views.includes(viewId)) {
      return { panel: h.panel, region: 'hidden' };
    }
  }
  return undefined;
}

/** Resolves a panel id or a view id to the panel holding it. */
export function resolvePanel(doc: LayoutDocument, id: string): PanelLocation | undefined {
  return locatePanel(doc, id) ?? locateView(doc, id);
}

export function allPanels(doc: LayoutDocument): PanelLocation[] {
  return [
    ...listPanels(doc.root).map((panel) => ({ panel, region: 'docked' as const })),
    ...doc.floating.map((f) => ({ panel: f.panel, region: 'floating' as const })),
  ];
}

/** Applies `fn` to the panel wherever it lives. Returning a panel without views removes it. */
export function updatePanel(doc: LayoutDocument, panelId: string, fn: (panel: PanelNode) => PanelNode): LayoutDocument {
  const location = locatePanel(doc, panelId);
  if (!location) {
    return doc;
  }
  const apply = (panel: PanelNode): PanelNode | null => {
    if (panel.id !== panelId) {
      return panel;
    }
    const next = fn(panel);
    return next.views.length ? sanitizePanel(next) : null;
  };
  switch (location.region) {
    case 'docked':
      return { ...doc, root: mapPanels(doc.root, apply) };
    case 'floating':
      return {
        ...doc,
        floating: doc.floating.flatMap((f) => {
          const panel = apply(f.panel);
          return panel ? [{ ...f, panel }] : [];
        }),
      };
    case 'hidden':
      return {
        ...doc,
        hidden: doc.hidden.flatMap((h) => {
          const panel = apply(h.panel);
          return panel ? [{ ...h, panel }] : [];
        }),
      };
  }
}

function sanitizePanel(panel: PanelNode): PanelNode {
  return panel.views.includes(panel.selected) ? panel : { ...panel, selected: panel.views[0] };
}

/** Removes a view from its panel without forgetting it. The neighbouring tab becomes selected. */
export function detachView(doc: LayoutDocument, viewId: string): LayoutDocument {
  const location = locateView(doc, viewId);
  if (!location) {
    return doc;
  }
  return updatePanel(doc, location.panel.id, (panel) => {
    const index = panel.views.indexOf(viewId);
    const views = panel.views.filter((v) => v !== viewId);
    const selected = panel.selected === viewId ? (views[Math.min(index, views.length - 1)] ?? '') : panel.selected;
    return { ...panel, views, selected };
  });
}

export function closeView(doc: LayoutDocument, viewId: string): LayoutDocument {
  const next = detachView(doc, viewId);
  const views = { ...next.views };
  delete views[viewId];
  return { ...next, views };
}

export function closeOtherViews(doc: LayoutDocument, panelId: string, keepViewId: string): LayoutDocument {
  const location = locatePanel(doc, panelId);
  if (!location) {
    return doc;
  }
  return location.panel.views.filter((v) => v !== keepViewId).reduce((d, v) => closeView(d, v), doc);
}

/** Removes a whole panel from wherever it lives. */
export function detachPanel(doc: LayoutDocument, panelId: string): LayoutDocument {
  const location = locatePanel(doc, panelId);
  if (!location) {
    return doc;
  }
  switch (location.region) {
    case 'docked':
      return { ...doc, root: removeNode(doc.root, panelId) };
    case 'floating':
      return { ...doc, floating: doc.floating.filter((f) => f.panel.id !== panelId) };
    case 'hidden':
      return { ...doc, hidden: doc.hidden.filter((h) => h.panel.id !== panelId) };
  }
}

export function selectView(doc: LayoutDocument, viewId: string): LayoutDocument {
  const location = locateView(doc, viewId);
  if (!location || location.panel.selected === viewId) {
    return doc;
  }
  return updatePanel(doc, location.panel.id, (panel) => ({ ...panel, selected: viewId }));
}

export function insertViewsIntoPanel(
  doc: LayoutDocument,
  panelId: string,
  viewIds: string[],
  index: number,
  selected: string
): LayoutDocument {
  return updatePanel(doc, panelId, (panel) => {
    const views = panel.views.filter((v) => !viewIds.includes(v));
    const at = Math.max(0, Math.min(index, views.length));
    views.splice(at, 0, ...viewIds);
    return { ...panel, views, selected };
  });
}

export function moveTab(doc: LayoutDocument, viewId: string, toIndex: number): LayoutDocument {
  const location = locateView(doc, viewId);
  if (!location) {
    return doc;
  }
  return insertViewsIntoPanel(doc, location.panel.id, [viewId], toIndex, location.panel.selected);
}

function topZ(doc: LayoutDocument): number {
  return doc.floating.reduce((z, f) => Math.max(z, f.z), 0);
}

export function addFloating(doc: LayoutDocument, panel: PanelNode, rect: Rect): LayoutDocument {
  return { ...doc, floating: [...doc.floating, { panel, rect, z: topZ(doc) + 1 }] };
}

export function raiseFloating(doc: LayoutDocument, panelId: string): LayoutDocument {
  const entry = doc.floating.find((f) => f.panel.id === panelId);
  const z = topZ(doc);
  if (!entry || (entry.z === z && doc.floating.filter((f) => f.z === z).length === 1)) {
    return doc;
  }
  return {
    ...doc,
    floating: doc.floating.map((f) => (f.panel.id === panelId ? { ...f, z: z + 1 } : f)),
  };
}

export function setFloatingRect(doc: LayoutDocument, panelId: string, rect: Rect): LayoutDocument {
  return {
    ...doc,
    floating: doc.floating.map((f) => (f.panel.id === panelId ? { ...f, rect } : f)),
  };
}

/**
 * Floats a panel, or a single view torn out of a panel with other tabs. `rect` is in fractions of
 * the workspace.
 */
export function floatPanel(doc: LayoutDocument, id: string, rect: Rect): LayoutDocument {
  const location = locatePanel(doc, id);
  if (location) {
    if (location.region === 'floating') {
      return setFloatingRect(doc, id, rect);
    }
    return addFloating(detachPanel(doc, id), location.panel, rect);
  }
  const viewLocation = locateView(doc, id);
  if (!viewLocation) {
    return doc;
  }
  if (viewLocation.panel.views.length === 1) {
    return floatPanel(doc, viewLocation.panel.id, rect);
  }
  const panel: PanelNode = { kind: 'panel', id: createId('panel'), views: [id], selected: id };
  return addFloating(detachView(doc, id), panel, rect);
}

/** Docks a floating panel along the right edge of the layout. */
export function dockFloating(doc: LayoutDocument, panelId: string, side: Side = 'right'): LayoutDocument {
  const entry = doc.floating.find((f) => f.panel.id === panelId);
  if (!entry) {
    return doc;
  }
  return {
    ...doc,
    floating: doc.floating.filter((f) => f !== entry),
    root: insertAtRootEdge(doc.root, side, entry.panel),
  };
}

function restoreTargetFor(doc: LayoutDocument, panelId: string): RestoreTarget {
  const floating = doc.floating.find((f) => f.panel.id === panelId);
  if (floating) {
    return { kind: 'floating', rect: floating.rect };
  }
  const location = findParent(doc.root, panelId);
  if (!location) {
    return { kind: 'root' };
  }
  const { parent, index } = location;
  // The next sibling absorbs the space (the previous one when this was last), so return beside it.
  const heirIndex = index + 1 < parent.children.length ? index + 1 : index - 1;
  const heir = parent.children[heirIndex];
  const before = heirIndex > index;
  const side: Side = parent.axis === 'x' ? (before ? 'left' : 'right') : before ? 'top' : 'bottom';
  const share = parent.weights[index] / (parent.weights[index] + parent.weights[heirIndex]);
  return { kind: 'beside', nodeId: heir.id, side, share };
}

/**
 * Hides a panel, or a single tab when the id is a view that shares its panel. Views stay in the
 * document and the panel remembers how to come back.
 */
export function hide(doc: LayoutDocument, id: string): LayoutDocument {
  const location = locatePanel(doc, id);
  if (location) {
    if (location.region === 'hidden') {
      return doc;
    }
    const restore = restoreTargetFor(doc, id);
    const hidden: HiddenPanel = { panel: location.panel, restore };
    const next = detachPanel(doc, id);
    return { ...next, hidden: [...next.hidden, hidden] };
  }
  const viewLocation = locateView(doc, id);
  if (!viewLocation || viewLocation.region === 'hidden') {
    return doc;
  }
  if (viewLocation.panel.views.length === 1) {
    return hide(doc, viewLocation.panel.id);
  }
  const panel: PanelNode = { kind: 'panel', id: createId('panel'), views: [id], selected: id };
  const restore: RestoreTarget = {
    kind: 'tab',
    panelId: viewLocation.panel.id,
    index: viewLocation.panel.views.indexOf(id),
  };
  const next = detachView(doc, id);
  return { ...next, hidden: [...next.hidden, { panel, restore }] };
}

const DEFAULT_FLOAT_RECT: Rect = { x: 0.25, y: 0.2, w: 0.5, h: 0.6 };

/** Puts a hidden panel back where it was, or floats it when that spot no longer exists. */
export function restore(doc: LayoutDocument, panelId: string): LayoutDocument {
  const entry = doc.hidden.find((h) => h.panel.id === panelId);
  if (!entry) {
    return doc;
  }
  const base: LayoutDocument = { ...doc, hidden: doc.hidden.filter((h) => h !== entry) };
  const { panel, restore: target } = entry;

  switch (target.kind) {
    case 'floating':
      return addFloating(base, panel, target.rect);
    case 'root':
      return base.root ? addFloating(base, panel, DEFAULT_FLOAT_RECT) : { ...base, root: panel };
    case 'tab': {
      const host = locatePanel(base, target.panelId);
      if (host && host.region !== 'hidden') {
        return insertViewsIntoPanel(base, target.panelId, panel.views, target.index, panel.selected);
      }
      return addFloating(base, panel, DEFAULT_FLOAT_RECT);
    }
    case 'beside': {
      if (base.root && findNode(base.root, target.nodeId)) {
        return {
          ...base,
          root: insertBeside(base.root, target.nodeId, target.side, panel, { shareOfTarget: target.share }),
        };
      }
      return addFloating(base, panel, DEFAULT_FLOAT_RECT);
    }
  }
}

export type OpenPlacement =
  | { kind: 'tab'; panelId: string; index?: number }
  | { kind: 'beside'; nodeId: string; side: Side }
  | { kind: 'edge'; side: Side }
  | { kind: 'float'; rect?: Rect };

/** Adds a new view. Without a placement it opens along the right edge of the layout. */
export function openView(
  doc: LayoutDocument,
  viewId: string,
  record: ViewRecord,
  placement: OpenPlacement = { kind: 'edge', side: 'right' }
): LayoutDocument {
  const withRecord: LayoutDocument = { ...detachView(doc, viewId), views: { ...doc.views, [viewId]: record } };
  const panel: PanelNode = { kind: 'panel', id: createId('panel'), views: [viewId], selected: viewId };

  switch (placement.kind) {
    case 'tab': {
      const host = resolvePanel(withRecord, placement.panelId);
      if (host) {
        const index = placement.index ?? host.panel.views.length;
        return insertViewsIntoPanel(withRecord, host.panel.id, [viewId], index, viewId);
      }
      break;
    }
    case 'beside':
      if (withRecord.root && findNode(withRecord.root, placement.nodeId)) {
        return { ...withRecord, root: insertBeside(withRecord.root, placement.nodeId, placement.side, panel) };
      }
      break;
    case 'float':
      return addFloating(withRecord, panel, placement.rect ?? cascadeRect(withRecord));
    case 'edge':
      break;
  }
  const side = placement.kind === 'edge' ? placement.side : 'right';
  return { ...withRecord, root: insertAtRootEdge(withRecord.root, side, panel) };
}

function cascadeRect(doc: LayoutDocument): Rect {
  const step = (doc.floating.length % 6) * 0.03;
  return { x: 0.3 + step, y: 0.2 + step, w: 0.4, h: 0.5 };
}

/** Repairs a document from storage or a consumer: unknown views, duplicates and empty containers. */
export function sanitizeDocument(doc: LayoutDocument): LayoutDocument {
  const seen = new Set<string>();
  const cleanPanel = (panel: PanelNode): PanelNode => {
    const views = panel.views.filter((v) => {
      if (seen.has(v) || !doc.views[v]) {
        return false;
      }
      seen.add(v);
      return true;
    });
    return sanitizePanel({ ...panel, views });
  };
  const root = normalize(mapPanels(doc.root, cleanPanel) ?? null);
  const floating: FloatingPanel[] = (doc.floating ?? [])
    .map((f) => ({ ...f, panel: cleanPanel(f.panel) }))
    .filter((f) => f.panel.views.length > 0);
  const hidden: HiddenPanel[] = (doc.hidden ?? [])
    .map((h) => ({ ...h, panel: cleanPanel(h.panel) }))
    .filter((h) => h.panel.views.length > 0);
  return { root, floating, hidden, views: doc.views ?? {} };
}

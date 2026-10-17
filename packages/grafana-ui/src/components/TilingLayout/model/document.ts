import { findPanel, findPanelByIdOrView, findPanelOfView } from './locate';
import {
  createId,
  findNode,
  findParentSplit,
  insertAtLayoutEdge,
  insertBesideNode,
  mapTreePanels,
  normalizeTree,
  removeNode,
} from './tree';
import {
  type FloatingPanel,
  type HiddenPanel,
  type LayoutDocument,
  type PanelNode,
  type Rect,
  type RestoreAnchor,
  type Side,
  type ViewRecord,
} from './types';

export function emptyDocument(): LayoutDocument {
  return { root: null, floating: [], hidden: [], views: {} };
}

/** Applies `fn` to the panel wherever it lives. Returning a panel without views removes it. */
export function updatePanel(doc: LayoutDocument, panelId: string, fn: (panel: PanelNode) => PanelNode): LayoutDocument {
  const location = findPanel(doc, panelId);
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
      return { ...doc, root: mapTreePanels(doc.root, apply) };
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
  const location = findPanelOfView(doc, viewId);
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
  const location = findPanel(doc, panelId);
  if (!location) {
    return doc;
  }
  return location.panel.views.filter((v) => v !== keepViewId).reduce((d, v) => closeView(d, v), doc);
}

/** Removes a whole panel from wherever it lives. */
export function detachPanel(doc: LayoutDocument, panelId: string): LayoutDocument {
  const location = findPanel(doc, panelId);
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
  const location = findPanelOfView(doc, viewId);
  if (!location || location.panel.selected === viewId) {
    return doc;
  }
  return updatePanel(doc, location.panel.id, (panel) => ({ ...panel, selected: viewId }));
}

export function addViewsToPanel(
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

export function reorderTab(doc: LayoutDocument, viewId: string, toIndex: number): LayoutDocument {
  const location = findPanelOfView(doc, viewId);
  if (!location) {
    return doc;
  }
  return addViewsToPanel(doc, location.panel.id, [viewId], toIndex, location.panel.selected);
}

function frontZ(doc: LayoutDocument): number {
  return doc.floating.reduce((z, f) => Math.max(z, f.z), 0);
}

export function addFloatingPanel(doc: LayoutDocument, panel: PanelNode, rect: Rect): LayoutDocument {
  return { ...doc, floating: [...doc.floating, { panel, rect, z: frontZ(doc) + 1 }] };
}

export function bringFloatingToFront(doc: LayoutDocument, panelId: string): LayoutDocument {
  const entry = doc.floating.find((f) => f.panel.id === panelId);
  const z = frontZ(doc);
  if (!entry || (entry.z === z && doc.floating.filter((f) => f.z === z).length === 1)) {
    return doc;
  }
  return {
    ...doc,
    floating: doc.floating.map((f) => (f.panel.id === panelId ? { ...f, z: z + 1 } : f)),
  };
}

export function setFloatingPanelRect(doc: LayoutDocument, panelId: string, rect: Rect): LayoutDocument {
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
  const location = findPanel(doc, id);
  if (location) {
    if (location.region === 'floating') {
      return setFloatingPanelRect(doc, id, rect);
    }
    return addFloatingPanel(detachPanel(doc, id), location.panel, rect);
  }
  const viewLocation = findPanelOfView(doc, id);
  if (!viewLocation) {
    return doc;
  }
  if (viewLocation.panel.views.length === 1) {
    return floatPanel(doc, viewLocation.panel.id, rect);
  }
  const panel: PanelNode = { kind: 'panel', id: createId('panel'), views: [id], selected: id };
  return addFloatingPanel(detachView(doc, id), panel, rect);
}

/** Docks a floating panel along the right edge of the layout. */
export function dockFloatingPanel(doc: LayoutDocument, panelId: string, side: Side = 'right'): LayoutDocument {
  const entry = doc.floating.find((f) => f.panel.id === panelId);
  if (!entry) {
    return doc;
  }
  return {
    ...doc,
    floating: doc.floating.filter((f) => f !== entry),
    root: insertAtLayoutEdge(doc.root, side, entry.panel),
  };
}

function restoreAnchorFor(doc: LayoutDocument, panelId: string): RestoreAnchor {
  const floating = doc.floating.find((f) => f.panel.id === panelId);
  if (floating) {
    return { kind: 'floating', rect: floating.rect };
  }
  const location = findParentSplit(doc.root, panelId);
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
export function hidePanel(doc: LayoutDocument, id: string): LayoutDocument {
  const location = findPanel(doc, id);
  if (location) {
    if (location.region === 'hidden') {
      return doc;
    }
    const restoreAt = restoreAnchorFor(doc, id);
    const hidden: HiddenPanel = { panel: location.panel, restore: restoreAt };
    const next = detachPanel(doc, id);
    return { ...next, hidden: [...next.hidden, hidden] };
  }
  const viewLocation = findPanelOfView(doc, id);
  if (!viewLocation || viewLocation.region === 'hidden') {
    return doc;
  }
  if (viewLocation.panel.views.length === 1) {
    return hidePanel(doc, viewLocation.panel.id);
  }
  const panel: PanelNode = { kind: 'panel', id: createId('panel'), views: [id], selected: id };
  const restore: RestoreAnchor = {
    kind: 'tab',
    panelId: viewLocation.panel.id,
    index: viewLocation.panel.views.indexOf(id),
  };
  const next = detachView(doc, id);
  return { ...next, hidden: [...next.hidden, { panel, restore }] };
}

const DEFAULT_FLOAT_RECT: Rect = { x: 0.25, y: 0.2, w: 0.5, h: 0.6 };

/** Puts a hidden panel back where it was, or floats it when that spot no longer exists. */
export function restorePanel(doc: LayoutDocument, panelId: string): LayoutDocument {
  const entry = doc.hidden.find((h) => h.panel.id === panelId);
  if (!entry) {
    return doc;
  }
  const base: LayoutDocument = { ...doc, hidden: doc.hidden.filter((h) => h !== entry) };
  const { panel, restore: target } = entry;

  switch (target.kind) {
    case 'floating':
      return addFloatingPanel(base, panel, target.rect);
    case 'root':
      return base.root ? addFloatingPanel(base, panel, DEFAULT_FLOAT_RECT) : { ...base, root: panel };
    case 'tab': {
      const host = findPanel(base, target.panelId);
      if (host && host.region !== 'hidden') {
        return addViewsToPanel(base, target.panelId, panel.views, target.index, panel.selected);
      }
      return addFloatingPanel(base, panel, DEFAULT_FLOAT_RECT);
    }
    case 'beside': {
      if (base.root && findNode(base.root, target.nodeId)) {
        return {
          ...base,
          root: insertBesideNode(base.root, target.nodeId, target.side, panel, { shareOfTarget: target.share }),
        };
      }
      return addFloatingPanel(base, panel, DEFAULT_FLOAT_RECT);
    }
  }
}

export type ViewPlacement =
  | { kind: 'tab'; panelId: string; index?: number }
  | { kind: 'beside'; nodeId: string; side: Side }
  | { kind: 'edge'; side: Side }
  | { kind: 'float'; rect?: Rect };

/** Adds a new view. Without a placement it opens along the right edge of the layout. */
export function openView(
  doc: LayoutDocument,
  viewId: string,
  record: ViewRecord,
  placement: ViewPlacement = { kind: 'edge', side: 'right' }
): LayoutDocument {
  const withRecord: LayoutDocument = { ...detachView(doc, viewId), views: { ...doc.views, [viewId]: record } };
  const panel: PanelNode = { kind: 'panel', id: createId('panel'), views: [viewId], selected: viewId };

  switch (placement.kind) {
    case 'tab': {
      const host = findPanelByIdOrView(withRecord, placement.panelId);
      if (host) {
        const index = placement.index ?? host.panel.views.length;
        return addViewsToPanel(withRecord, host.panel.id, [viewId], index, viewId);
      }
      break;
    }
    case 'beside':
      if (withRecord.root && findNode(withRecord.root, placement.nodeId)) {
        return { ...withRecord, root: insertBesideNode(withRecord.root, placement.nodeId, placement.side, panel) };
      }
      break;
    case 'float':
      return addFloatingPanel(withRecord, panel, placement.rect ?? cascadeRect(withRecord));
    case 'edge':
      break;
  }
  const side = placement.kind === 'edge' ? placement.side : 'right';
  return { ...withRecord, root: insertAtLayoutEdge(withRecord.root, side, panel) };
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
  const root = normalizeTree(mapTreePanels(doc.root, cleanPanel) ?? null);
  const floating: FloatingPanel[] = (doc.floating ?? [])
    .map((f) => ({ ...f, panel: cleanPanel(f.panel) }))
    .filter((f) => f.panel.views.length > 0);
  const hidden: HiddenPanel[] = (doc.hidden ?? [])
    .map((h) => ({ ...h, panel: cleanPanel(h.panel) }))
    .filter((h) => h.panel.views.length > 0);
  return { root, floating, hidden, views: doc.views ?? {} };
}

import { addFloatingPanel, addViewsToPanel } from './document';
import { findPanel } from './locate';
import {
  DROP_PREVIEW_ID,
  findNode,
  insertAtLayoutEdge,
  insertBesideNode,
  insertChild,
  normalizeTree,
  replaceNode,
} from './tree';
import { type DropTarget, type LayoutDocument, type LayoutNode, type PanelNode, type Side } from './types';

export function createDropPreviewPanel(): PanelNode {
  return { kind: 'panel', id: DROP_PREVIEW_ID, views: [], selected: '' };
}

function insertAtDivider(
  root: LayoutNode,
  target: Extract<DropTarget, { kind: 'divider' }>,
  panel: PanelNode
): LayoutNode {
  const split = findNode(root, target.splitId);
  if (split?.kind === 'split') {
    const next = target.nextId ? split.children.findIndex((c) => c.id === target.nextId) : -1;
    const prev = target.prevId ? split.children.findIndex((c) => c.id === target.prevId) : -1;
    const index = next >= 0 ? next : prev >= 0 ? prev + 1 : -1;
    if (index >= 0) {
      return (
        normalizeTree(replaceNode(root, split.id, (s) => (s.kind === 'split' ? insertChild(s, index, panel) : s))) ??
        panel
      );
    }
  }
  // The split collapsed when the source left it: dock beside whichever neighbour survived.
  const startSide: Side = target.axis === 'x' ? 'left' : 'top';
  const endSide: Side = target.axis === 'x' ? 'right' : 'bottom';
  if (target.nextId && findNode(root, target.nextId)) {
    return insertBesideNode(root, target.nextId, startSide, panel);
  }
  if (target.prevId && findNode(root, target.prevId)) {
    return insertBesideNode(root, target.prevId, endSide, panel);
  }
  return insertAtLayoutEdge(root, endSide, panel);
}

/**
 * Places `panel` at `target` in a document the dragged source has already been removed from. With the drop
 * slot placeholder as `panel`, the result is the preview layout.
 */
export function applyDrop(base: LayoutDocument, panel: PanelNode, target: DropTarget): LayoutDocument {
  const isSlot = panel.id === DROP_PREVIEW_ID;
  switch (target.kind) {
    case 'tab': {
      if (isSlot) {
        return base;
      }
      const host = findPanel(base, target.panelId);
      if (host && host.region !== 'hidden') {
        return addViewsToPanel(base, target.panelId, panel.views, target.index, panel.selected);
      }
      return { ...base, root: insertAtLayoutEdge(base.root, 'right', panel) };
    }
    case 'panel-edge':
      if (base.root && findNode(base.root, target.panelId)) {
        return { ...base, root: insertBesideNode(base.root, target.panelId, target.side, panel) };
      }
      return { ...base, root: insertAtLayoutEdge(base.root, target.side, panel) };
    case 'divider':
      return { ...base, root: base.root ? insertAtDivider(base.root, target, panel) : panel };
    case 'layout-edge':
      return { ...base, root: insertAtLayoutEdge(base.root, target.side, panel) };
    case 'root':
      return { ...base, root: base.root ? insertAtLayoutEdge(base.root, 'right', panel) : panel };
    case 'float':
      return isSlot ? base : addFloatingPanel(base, panel, target.rect);
  }
}

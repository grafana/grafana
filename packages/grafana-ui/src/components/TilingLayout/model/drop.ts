import { addFloating, insertViewsIntoPanel, locatePanel } from './document';
import {
  DROP_SLOT_ID,
  findNode,
  insertAtRootEdge,
  insertBeside,
  insertIntoSplit,
  normalize,
  replaceNode,
} from './tree';
import { type DropTarget, type LayoutDocument, type LayoutNode, type PanelNode, type Side } from './types';

export function createDropSlot(): PanelNode {
  return { kind: 'panel', id: DROP_SLOT_ID, views: [], selected: '' };
}

function insertAtSeam(root: LayoutNode, target: Extract<DropTarget, { kind: 'seam' }>, panel: PanelNode): LayoutNode {
  const split = findNode(root, target.splitId);
  if (split?.kind === 'split') {
    const next = target.nextId ? split.children.findIndex((c) => c.id === target.nextId) : -1;
    const prev = target.prevId ? split.children.findIndex((c) => c.id === target.prevId) : -1;
    const index = next >= 0 ? next : prev >= 0 ? prev + 1 : -1;
    if (index >= 0) {
      return (
        normalize(replaceNode(root, split.id, (s) => (s.kind === 'split' ? insertIntoSplit(s, index, panel) : s))) ??
        panel
      );
    }
  }
  // The split collapsed when the source left it: dock beside whichever neighbour survived.
  const startSide: Side = target.axis === 'x' ? 'left' : 'top';
  const endSide: Side = target.axis === 'x' ? 'right' : 'bottom';
  if (target.nextId && findNode(root, target.nextId)) {
    return insertBeside(root, target.nextId, startSide, panel);
  }
  if (target.prevId && findNode(root, target.prevId)) {
    return insertBeside(root, target.prevId, endSide, panel);
  }
  return insertAtRootEdge(root, endSide, panel);
}

/**
 * Places `panel` at `target` in a document the dragged source has already been removed from. With the drop
 * slot placeholder as `panel`, the result is the preview layout.
 */
export function applyDrop(base: LayoutDocument, panel: PanelNode, target: DropTarget): LayoutDocument {
  const isSlot = panel.id === DROP_SLOT_ID;
  switch (target.kind) {
    case 'tab': {
      if (isSlot) {
        return base;
      }
      const host = locatePanel(base, target.panelId);
      if (host && host.region !== 'hidden') {
        return insertViewsIntoPanel(base, target.panelId, panel.views, target.index, panel.selected);
      }
      return { ...base, root: insertAtRootEdge(base.root, 'right', panel) };
    }
    case 'edge':
      if (base.root && findNode(base.root, target.panelId)) {
        return { ...base, root: insertBeside(base.root, target.panelId, target.side, panel) };
      }
      return { ...base, root: insertAtRootEdge(base.root, target.side, panel) };
    case 'seam':
      return { ...base, root: base.root ? insertAtSeam(base.root, target, panel) : panel };
    case 'frame':
      return { ...base, root: insertAtRootEdge(base.root, target.side, panel) };
    case 'root':
      return { ...base, root: base.root ? insertAtRootEdge(base.root, 'right', panel) : panel };
    case 'float':
      return isSlot ? base : addFloating(base, panel, target.rect);
  }
}

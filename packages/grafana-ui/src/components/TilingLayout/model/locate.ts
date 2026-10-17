import { collectPanels, findNode } from './tree';
import { type LayoutDocument, type PanelMode, type PanelNode } from './types';

export interface PanelLookup {
  panel: PanelNode;
  region: PanelMode;
}

export function findPanel(doc: LayoutDocument, panelId: string): PanelLookup | undefined {
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

export function findPanelOfView(doc: LayoutDocument, viewId: string): PanelLookup | undefined {
  for (const panel of collectPanels(doc.root)) {
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
export function findPanelByIdOrView(doc: LayoutDocument, id: string): PanelLookup | undefined {
  return findPanel(doc, id) ?? findPanelOfView(doc, id);
}

export function listVisiblePanels(doc: LayoutDocument): PanelLookup[] {
  return [
    ...collectPanels(doc.root).map((panel) => ({ panel, region: 'docked' as const })),
    ...doc.floating.map((f) => ({ panel: f.panel, region: 'floating' as const })),
  ];
}

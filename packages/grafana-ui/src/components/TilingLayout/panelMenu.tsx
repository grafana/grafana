import { t } from '@grafana/i18n';

import { Menu } from '../Menu/Menu';

import { allPanels, detachView, insertViewsIntoPanel } from './model/document';
import { createId, findNode, insertBeside } from './model/tree';
import { type LayoutDocument, type PanelNode, type Side } from './model/types';
import { type TilingLayoutApi, type TilingMenuEntry, type TilingMenuItem, type TilingPanelInfo } from './types';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MAXIMIZE_SHORTCUT = isMac ? '⇧⌘↩' : 'Ctrl+Shift+Enter';

interface BuildMenuOptions {
  panel: TilingPanelInfo;
  doc: LayoutDocument;
  api: TilingLayoutApi;
  maximizeEnabled: boolean;
  floatingEnabled: boolean;
  closable: boolean;
  titleOf: (viewId: string) => string;
}

function moveViewToPanel(doc: LayoutDocument, viewId: string, panelId: string): LayoutDocument {
  const detached = detachView(doc, viewId);
  const target = allPanels(detached).find((p) => p.panel.id === panelId);
  return target ? insertViewsIntoPanel(detached, panelId, [viewId], target.panel.views.length, viewId) : doc;
}

function splitViewOut(doc: LayoutDocument, viewId: string, panelId: string, side: Side): LayoutDocument {
  const detached = detachView(doc, viewId);
  if (!detached.root || !findNode(detached.root, panelId)) {
    return doc;
  }
  const panel: PanelNode = { kind: 'panel', id: createId('panel'), views: [viewId], selected: viewId };
  return { ...detached, root: insertBeside(detached.root, panelId, side, panel) };
}

/** The built-in panel menu: what drag and drop can do, reachable from the keyboard. */
export function buildPanelMenu({
  panel,
  doc,
  api,
  maximizeEnabled,
  floatingEnabled,
  closable,
  titleOf,
}: BuildMenuOptions): TilingMenuEntry[] {
  const entries: TilingMenuEntry[] = [];
  const view = panel.selectedView;
  const docked = panel.region === 'docked';

  if (docked && maximizeEnabled) {
    entries.push({
      id: 'maximize',
      label: panel.maximized
        ? t('grafana-ui.tiling-layout.menu.restore', 'Restore size')
        : t('grafana-ui.tiling-layout.menu.maximize', 'Maximize'),
      icon: panel.maximized ? 'compress-arrows' : 'expand-arrows',
      shortcut: MAXIMIZE_SHORTCUT,
      onClick: () => api.toggleMaximize(panel.id),
    });
  }
  if (docked && floatingEnabled) {
    entries.push({
      id: 'float',
      label: t('grafana-ui.tiling-layout.menu.float', 'Float'),
      icon: 'layers-alt',
      onClick: () => api.floatPanel(panel.id),
    });
  }
  if (panel.region === 'floating') {
    entries.push({
      id: 'dock',
      label: t('grafana-ui.tiling-layout.menu.dock', 'Dock'),
      icon: 'gf-grid',
      onClick: () => api.dockPanel(panel.id),
    });
  }

  const destinations: TilingMenuEntry[] = allPanels(doc)
    .filter((p) => p.panel.id !== panel.id)
    .map((p) => ({
      id: `move:${p.panel.id}`,
      label: p.panel.views.map(titleOf).join(', '),
      onClick: () => api.update((d) => moveViewToPanel(d, view.id, p.panel.id)),
    }));
  if (docked && panel.views.length > 1) {
    if (destinations.length) {
      destinations.push('divider');
    }
    destinations.push(
      {
        id: 'split-right',
        label: t('grafana-ui.tiling-layout.menu.split-right', 'New split right'),
        onClick: () => api.update((d) => splitViewOut(d, view.id, panel.id, 'right')),
      },
      {
        id: 'split-below',
        label: t('grafana-ui.tiling-layout.menu.split-below', 'New split below'),
        onClick: () => api.update((d) => splitViewOut(d, view.id, panel.id, 'bottom')),
      }
    );
  }
  if (destinations.length) {
    entries.push({
      id: 'move',
      label: t('grafana-ui.tiling-layout.menu.move', 'Move {{title}} to', { title: view.title }),
      icon: 'arrow-right',
      items: destinations,
    });
  }

  entries.push({
    id: 'hide',
    label: t('grafana-ui.tiling-layout.menu.hide', 'Hide'),
    icon: 'eye-slash',
    onClick: () => api.hide(panel.id),
  });

  entries.push('divider');
  if (closable) {
    entries.push({
      id: 'close',
      label: t('grafana-ui.tiling-layout.menu.close', 'Close {{title}}', { title: view.title }),
      icon: 'times',
      onClick: () => api.closeView(view.id),
    });
  }
  if (panel.views.length > 1) {
    entries.push({
      id: 'close-others',
      label: t('grafana-ui.tiling-layout.menu.close-others', 'Close other tabs'),
      onClick: () => panel.views.filter((v) => v.id !== view.id).forEach((v) => api.closeView(v.id)),
    });
  }
  return entries;
}

/** Drops dividers at the start or end and repeated dividers. */
export function tidyMenuEntries(entries: TilingMenuEntry[]): TilingMenuEntry[] {
  const out: TilingMenuEntry[] = [];
  for (const entry of entries) {
    if (entry === 'divider' && (out.length === 0 || out[out.length - 1] === 'divider')) {
      continue;
    }
    out.push(entry);
  }
  while (out[out.length - 1] === 'divider') {
    out.pop();
  }
  return out;
}

function renderItem(item: TilingMenuItem, close: () => void, key: string) {
  return (
    <Menu.Item
      key={key}
      label={item.label}
      icon={item.checked ? 'check' : item.icon}
      shortcut={item.shortcut}
      disabled={item.disabled}
      destructive={item.destructive}
      role={item.checked !== undefined ? 'menuitemcheckbox' : undefined}
      ariaChecked={item.checked}
      onClick={
        item.items
          ? undefined
          : () => {
              close();
              item.onClick?.();
            }
      }
      childItems={item.items && renderTilingMenuEntries(tidyMenuEntries(item.items), close)}
    />
  );
}

/** Renders menu entries as Grafana menu items, for use in `renderPanelMenu`. */
export function renderTilingMenuEntries(entries: TilingMenuEntry[], close: () => void) {
  return entries.map((entry, i) =>
    entry === 'divider' ? <Menu.Divider key={`divider-${i}`} /> : renderItem(entry, close, entry.id ?? `item-${i}`)
  );
}

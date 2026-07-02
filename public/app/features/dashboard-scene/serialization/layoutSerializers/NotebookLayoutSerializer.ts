import {
  type NotebookLayoutItemKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { NotebookCellItem } from '../../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../../scene/layout-notebook/NotebookLayoutManager';
import { type PanelIdGenerator } from '../../utils/dashboardSceneGraph';

import { buildLibraryPanel, buildVizPanel } from './utils';

export function deserializeNotebookLayout(
  layout: DashboardV2Spec['layout'],
  elements: DashboardV2Spec['elements'],
  _preload: boolean,
  panelIdGenerator?: PanelIdGenerator
): NotebookLayoutManager {
  // NotebookLayout is a member of the dashboard layout union, so this is a plain
  // discriminated-union narrowing — no cast needed (unlike the sibling-resource variant).
  if (layout.kind !== 'NotebookLayout') {
    throw new Error('Invalid layout kind');
  }

  const cells: NotebookCellItem[] = [];
  for (const item of layout.spec.cells) {
    const elementName = item.spec.element.name;
    // `elements` is Record<string, Element> where Element = PanelKind | LibraryPanelKind | CellKind,
    // so the notebook cell union is already in the dashboard type — no cast to bridge schemas.
    const element = elements[elementName];
    if (!element) {
      continue;
    }

    // collapsed is optional in the schema; keep it undefined when omitted so serialize round-trips faithfully.
    const base = {
      elementName,
      source: item.spec.source,
      collapsed: item.spec.collapsed,
    };

    if (element.kind === 'Panel') {
      cells.push(new NotebookCellItem({ ...base, body: buildVizPanel(element, panelIdGenerator?.()) }));
    } else if (element.kind === 'LibraryPanel') {
      cells.push(new NotebookCellItem({ ...base, body: buildLibraryPanel(element, panelIdGenerator?.()) }));
    } else if (element.kind === 'Cell') {
      cells.push(new NotebookCellItem({ ...base, content: element.spec.content }));
    }
  }

  return new NotebookLayoutManager({ cells });
}

export function serializeNotebookLayout(manager: NotebookLayoutManager): DashboardV2Spec['layout'] {
  const cells: NotebookLayoutItemKind[] = manager.state.cells.map((cell) => ({
    kind: 'NotebookLayoutItem',
    spec: {
      element: { kind: 'ElementReference', name: cell.state.elementName },
      source: cell.state.source,
      // Emit collapsed only when it was set, so an omitted value stays omitted on round-trip.
      ...(cell.state.collapsed !== undefined ? { collapsed: cell.state.collapsed } : {}),
    },
  }));

  // NotebookLayout is in the dashboard layout union, so this returns without a cast.
  return { kind: 'NotebookLayout', spec: { cells } };
}

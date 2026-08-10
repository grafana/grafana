import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type NotebookElement, type NotebookLayoutKind } from 'app/features/notebook/types';

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
  // NotebookLayout is not part of the dashboard layout union, so narrow via a cast.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- notebook layout is a sibling kind not in DashboardV2Spec['layout']
  const notebookLayout = layout as unknown as NotebookLayoutKind;
  if (notebookLayout.kind !== 'NotebookLayout') {
    throw new Error('Invalid layout kind');
  }

  const cells: NotebookCellItem[] = [];
  for (const item of notebookLayout.spec.cells) {
    const elementName = item.spec.element.name;
    // `elements` is typed DashboardV2Spec['elements'] = Record<string, PanelKind | LibraryPanelKind>
    // (the dashboard element union, which has no CellKind). A notebook's elements really do include
    // CellKind at runtime, and we branch on element.kind === 'Cell' below, so widen through
    // `unknown`. A plain widening assignment does not work: it keeps the declared union and the
    // Cell branch collapses to `never`. Unlike the leaf types, this one is a genuine difference
    // between the notebook and dashboard element unions, not a cross-module artifact.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- notebook is a sibling kind riding the dashboard-typed transformer
    const element = elements[elementName] as unknown as NotebookElement | undefined;
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
      // buildVizPanel is dashboard-typed and takes this directly: the notebook panel chain carries
      // the dashboard v2 shape, so the two generated types are structurally identical.
      cells.push(new NotebookCellItem({ ...base, body: buildVizPanel(element, panelIdGenerator?.()) }));
    } else if (element.kind === 'LibraryPanel') {
      cells.push(new NotebookCellItem({ ...base, body: buildLibraryPanel(element, panelIdGenerator?.()) }));
    } else if (element.kind === 'Cell') {
      cells.push(new NotebookCellItem({ ...base, content: element.spec.content }));
    }
  }

  return new NotebookLayoutManager({ cells });
}

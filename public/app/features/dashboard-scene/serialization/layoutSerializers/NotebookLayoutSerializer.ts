import {
  type LibraryPanelKind as DashboardLibraryPanelKind,
  type PanelKind as DashboardPanelKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type NotebookElement, type NotebookLayoutKind } from '@grafana/schema/apis/notebook/v2beta1';

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
    // (the dashboard element union, which has no CellKind). A notebook's elements really do
    // include CellKind at runtime, and we branch on element.kind === 'Cell' below. TS rejects a
    // direct `as NotebookElement` because the two unions aren't considered related enough
    // ("neither sufficiently overlaps the other"), so we widen through `unknown` to bridge them.
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
      // Notebook PanelKind is structurally identical to the dashboard PanelKind buildVizPanel expects.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- identical leaf type across the two schemas
      const panel = element as unknown as DashboardPanelKind;
      cells.push(new NotebookCellItem({ ...base, body: buildVizPanel(panel, panelIdGenerator?.()) }));
    } else if (element.kind === 'LibraryPanel') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- identical leaf type across the two schemas
      const libraryPanel = element as unknown as DashboardLibraryPanelKind;
      cells.push(new NotebookCellItem({ ...base, body: buildLibraryPanel(libraryPanel, panelIdGenerator?.()) }));
    } else if (element.kind === 'Cell') {
      cells.push(new NotebookCellItem({ ...base, content: element.spec.content }));
    }
  }

  return new NotebookLayoutManager({ cells });
}

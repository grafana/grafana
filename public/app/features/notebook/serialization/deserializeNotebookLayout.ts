import { VizPanel } from '@grafana/scenes';
import { type PanelKind as DashboardPanelKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type NotebookElement, type NotebookLayoutKind } from '@grafana/schema/apis/notebook/v2beta1';
import {
  buildLibraryPanelState,
  buildVizPanelState,
} from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';

import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

interface NotebookHeader {
  title?: string;
  tags?: string[];
}

/**
 * Builds the notebook layout manager from the spec's layout + elements.
 *
 * Panels are constructed from the shared dashboard-free core (buildVizPanelState /
 * buildLibraryPanelState): no panel menu, no header actions, no dashboard panel context — those
 * are dashboard chrome that resolves the root via getDashboardSceneFor and would throw under the
 * composed NotebookScene. The notebook's own cell affordances replace them later.
 */
export function deserializeNotebookLayout(
  layout: NotebookLayoutKind,
  elements: Record<string, NotebookElement>,
  header?: NotebookHeader
): NotebookLayoutManager {
  if (layout.kind !== 'NotebookLayout') {
    throw new Error(`Invalid notebook layout kind: ${layout.kind}`);
  }

  const cells: NotebookCellItem[] = [];
  for (const item of layout.spec.cells) {
    const elementName = item.spec.element.name;
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
      // The notebook and dashboard PanelKind are identical EXCEPT at
      // spec.data.spec.transformations: notebook v2beta1 uses { kind: <transformId>, spec:
      // DataTransformerConfig } while dashboard v2 uses { kind: 'Transformation', group:
      // <transformId>, spec: TransformationSpec }. `group` is required on the dashboard side, so
      // the assignment is genuinely unsound at the type level and needs the `unknown` bridge.
      //
      // It is sound at RUNTIME: buildVizPanelState → createPanelDataProvider maps every
      // transformation through normalizeTransformation (serialization/transformationCompat.ts),
      // which accepts both wire shapes. The bridge goes away when the notebook spec migrates to
      // v2 (team decision 0).
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- transformations diverge between v2beta1 and v2; normalizeTransformation handles both at runtime
      const panel = element as unknown as DashboardPanelKind;
      cells.push(new NotebookCellItem({ ...base, body: new VizPanel(buildVizPanelState(panel)) }));
    } else if (element.kind === 'LibraryPanel') {
      // No bridge needed: LibraryPanelKind is structurally identical across the two schemas and
      // carries no transformations, so it assigns directly.
      cells.push(new NotebookCellItem({ ...base, body: new VizPanel(buildLibraryPanelState(element)) }));
    } else if (element.kind === 'Cell') {
      cells.push(new NotebookCellItem({ ...base, content: element.spec.content }));
    }
  }

  return new NotebookLayoutManager({ cells, title: header?.title, tags: header?.tags });
}

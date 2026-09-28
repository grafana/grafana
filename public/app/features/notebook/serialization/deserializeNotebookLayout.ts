import { VizPanel } from '@grafana/scenes';
import {
  buildLibraryPanelState,
  buildVizPanelState,
} from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { type PanelIdGenerator } from 'app/features/dashboard-scene/utils/dashboardSceneGraph';

import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';
import { type NotebookElement, type NotebookLayoutKind } from '../types';

interface NotebookHeader {
  title?: string;
  tags?: string[];
}

/**
 * Builds the notebook layout manager from the spec's layout + elements.
 *
 * Panel ids follow the dashboard's strategy (see deserializeGridItem): omitting `panelIdGenerator`
 * keeps the id each element carries, so uniqueness across `elements` is the producer's to guarantee,
 * and a caller that needs fresh ids passes a generator instead.
 */
export function deserializeNotebookLayout(
  layout: NotebookLayoutKind,
  elements: Record<string, NotebookElement>,
  header?: NotebookHeader,
  panelIdGenerator?: PanelIdGenerator
): NotebookLayoutManager {
  if (layout.kind !== 'NotebookLayout') {
    throw new Error(`Invalid notebook layout kind: ${layout.kind}`);
  }

  const cells: NotebookCellItem[] = [];
  for (const item of layout.spec.cells) {
    const elementName = item.spec.element.name;
    // hasOwn, not a bare lookup: `elements` is caller-supplied JSON, so a cell named `constructor`
    // would resolve to an inherited member and reach the unknown-kind throw instead of being skipped.
    const element = Object.hasOwn(elements, elementName) ? elements[elementName] : undefined;
    if (!element) {
      continue;
    }

    // Read before the branches narrow `element` away, so the guard below can name the kind.
    const elementKind = element.kind;

    // collapsed is optional in the schema; keep it undefined when omitted so serialize round-trips faithfully.
    const base = {
      elementName,
      source: item.spec.source,
      collapsed: item.spec.collapsed,
    };

    if (element.kind === 'Panel') {
      // buildVizPanelState is dashboard-typed and takes this directly: the notebook panel chain
      // carries the dashboard v2 shape, so the two generated types are structurally identical.
      cells.push(
        new NotebookCellItem({ ...base, body: new VizPanel(buildVizPanelState(element, panelIdGenerator?.())) })
      );
    } else if (element.kind === 'LibraryPanel') {
      cells.push(
        new NotebookCellItem({ ...base, body: new VizPanel(buildLibraryPanelState(element, panelIdGenerator?.())) })
      );
    } else if (element.kind === 'Cell') {
      cells.push(new NotebookCellItem({ ...base, content: element.spec.content }));
    } else {
      // serialize() walks cells, so an unhandled element kind would drop both the element and its
      // layout item on the next save. Unreachable today: this fails when a fourth kind is added.
      throw new Error(`Unknown notebook element kind: ${elementKind}`);
    }
  }

  return new NotebookLayoutManager({ cells, title: header?.title, tags: header?.tags });
}

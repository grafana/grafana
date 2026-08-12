import { VizPanel } from '@grafana/scenes';
import {
  buildLibraryPanelState,
  buildVizPanelState,
} from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';

import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';
import { type NotebookElement, type NotebookLayoutKind } from '../types';

interface NotebookHeader {
  title?: string;
  tags?: string[];
}

/**
 * Builds the notebook layout manager from the spec's layout + elements.
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
      cells.push(new NotebookCellItem({ ...base, body: new VizPanel(buildVizPanelState(element)) }));
    } else if (element.kind === 'LibraryPanel') {
      cells.push(new NotebookCellItem({ ...base, body: new VizPanel(buildLibraryPanelState(element)) }));
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

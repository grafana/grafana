import { lazy, type ComponentType } from 'react';

import { Registry, type RegistryItem } from '@grafana/data';
import { type CellContentKind } from 'app/features/notebook/types';

import { type NotebookCellItem } from '../NotebookCellItem';

const CodeCell = lazy(() =>
  import(/* webpackChunkName: "notebook-code-cell" */ './CodeCell').then((m) => ({ default: m.CodeCell }))
);

// "Markdown" isn't registered here: NotebookCellRenderer's NarrativeCell special-cases
// content.kind === 'Markdown' and renders SpecialMarkdownCell directly, ahead of this registry, since
// markdown cells need placeholder text, the "/" block menu, and onSubmit — none of which fit this
// generic contract without every other renderer having to explicitly opt out. This registry exists for
// everything else that carries narrative content, currently just Code — a query-first block produces a
// real Panel element instead (see NotebookLayoutManager's buildCellFor), rendered through the `body`
// branch in NotebookCellRenderer rather than through this registry.
export interface CellTypeRegistryItem extends RegistryItem {
  // id matches CellContentKind['kind']; each renderer narrows the content by that kind. `isEditing`,
  // `autoFocus` and `onChange` are offered to every cell type; a renderer with nothing to use one
  // simply does not accept it. `cell` is the scene object this content belongs to — a real node in the
  // scene graph, parented under the notebook's own `$timeRange` — available to a renderer that needs
  // the shared time range, without it being threaded down as a prop by ones that don't care about it.
  render: ComponentType<{
    content: CellContentKind;
    isEditing: boolean;
    autoFocus?: boolean;
    cell: NotebookCellItem;
    onChange: (content: CellContentKind) => void;
  }>;
}

export const cellTypeRegistry = new Registry<CellTypeRegistryItem>(() => [
  { id: 'Code', name: 'Code', render: CodeCell },
]);

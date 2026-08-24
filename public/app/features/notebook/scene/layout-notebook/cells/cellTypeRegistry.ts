import { lazy, type ComponentType } from 'react';

import { Registry, type RegistryItem } from '@grafana/data';
import { type CellContentKind } from 'app/features/notebook/types';

import { type NotebookCellItem } from '../NotebookCellItem';

import { QueryCell } from './QueryCell';

const CodeCell = lazy(() =>
  import(/* webpackChunkName: "notebook-code-cell" */ './CodeCell').then((m) => ({ default: m.CodeCell }))
);

// "Markdown" isn't registered here: NotebookCellRenderer's NarrativeCell special-cases
// content.kind === 'Markdown' and renders SpecialMarkdownCell directly, ahead of this registry, since
// markdown cells need placeholder text, the "/" block menu, and onSubmit — none of which fit this
// generic contract without every other renderer having to explicitly opt out. This registry exists for
// everything that doesn't need those, currently Code and Query.
export interface CellTypeRegistryItem extends RegistryItem {
  // id matches CellContentKind['kind']; each renderer narrows the content by that kind. `isEditing`,
  // `autoFocus` and `onChange` are offered to every cell type; a renderer with nothing to use one
  // simply does not accept it. `cell` is the scene object this content belongs to — a real node in the
  // scene graph, parented under the notebook's own `$timeRange` — so a renderer that needs the shared
  // time range (currently just Query) can read it directly via `sceneGraph.getTimeRange(cell)` rather
  // than have it threaded down as a prop by components that don't otherwise care about it.
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
  { id: 'Query', name: 'Query', render: QueryCell },
]);

import { lazy, type ComponentType } from 'react';

import { Registry, type RegistryItem, type TimeRange } from '@grafana/data';
import { type CellContentKind } from 'app/features/notebook/types';

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
  // simply does not accept it. `range` is the notebook's own shared time range (see
  // NotebookLayoutManagerRenderer) — only Query reads it today, run against whatever range the reader
  // has the notebook set to, the same way Explore's queries follow its own time picker.
  render: ComponentType<{
    content: CellContentKind;
    isEditing: boolean;
    autoFocus?: boolean;
    range?: TimeRange;
    onChange: (content: CellContentKind) => void;
  }>;
}

export const cellTypeRegistry = new Registry<CellTypeRegistryItem>(() => [
  { id: 'Code', name: 'Code', render: CodeCell },
  { id: 'Query', name: 'Query', render: QueryCell },
]);

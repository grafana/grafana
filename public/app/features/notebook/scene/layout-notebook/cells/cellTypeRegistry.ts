import { lazy, type ComponentType } from 'react';

import { Registry, type RegistryItem } from '@grafana/data';
import { type CellContentKind } from 'app/features/notebook/types';

const CodeCell = lazy(() =>
  import(/* webpackChunkName: "notebook-code-cell" */ './CodeCell').then((m) => ({ default: m.CodeCell }))
);

// "Markdown" isn't registered here: NotebookCellRenderer's NarrativeCell special-cases
// content.kind === 'Markdown' and renders SpecialMarkdownCell directly, ahead of this registry, since
// markdown cells need placeholder text, the "/" block menu, and onSubmit — none of which fit this
// generic contract without every other renderer having to explicitly opt out. This registry exists for
// everything that doesn't need those, currently just Code.
export interface CellTypeRegistryItem extends RegistryItem {
  // id matches CellContentKind['kind']; each renderer narrows the content by that kind. `isEditing`,
  // `autoFocus` and `onChange` are offered to every cell type; a renderer with nothing to focus simply
  // does not accept it.
  render: ComponentType<{
    content: CellContentKind;
    isEditing: boolean;
    autoFocus?: boolean;
    onChange: (content: CellContentKind) => void;
  }>;
}

export const cellTypeRegistry = new Registry<CellTypeRegistryItem>(() => [
  { id: 'Code', name: 'Code', render: CodeCell },
]);

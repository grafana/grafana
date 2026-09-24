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
  render: ComponentType<{
    content: CellContentKind;
    isEditing: boolean;
    autoFocus?: boolean;
    focusRequestId?: number;
    caretOffset?: number;
    scrollAlign?: ScrollLogicalPosition;
    cell: NotebookCellItem;
    onChange: (content: CellContentKind) => void;
    onNavigate?: (direction: 'up' | 'down') => void;
  }>;
}

export const cellTypeRegistry = new Registry<CellTypeRegistryItem>(() => [
  { id: 'Code', name: 'Code', render: CodeCell },
]);

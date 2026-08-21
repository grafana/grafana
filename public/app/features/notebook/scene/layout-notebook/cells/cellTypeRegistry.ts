import { lazy, type ComponentType } from 'react';

import { Registry, type RegistryItem } from '@grafana/data';
import { type CellContentKind } from 'app/features/notebook/types';

import { MarkdownCell } from './MarkdownCell';

const CodeCell = lazy(() =>
  import(/* webpackChunkName: "notebook-code-cell" */ './CodeCell').then((m) => ({ default: m.CodeCell }))
);

export interface CellTypeRegistryItem extends RegistryItem {
  // id matches CellContentKind['kind'] ('Markdown' | 'Code'); each renderer narrows
  // the content by that kind. `isEditing`, `autoFocus` and `onChange` are offered to every cell type;
  // a renderer with nothing to change or nothing to focus simply does not accept them.
  render: ComponentType<{
    content: CellContentKind;
    isEditing: boolean;
    autoFocus?: boolean;
    onChange: (content: CellContentKind) => void;
  }>;
}

export const cellTypeRegistry = new Registry<CellTypeRegistryItem>(() => [
  { id: 'Markdown', name: 'Markdown', render: MarkdownCell },
  { id: 'Code', name: 'Code', render: CodeCell },
]);

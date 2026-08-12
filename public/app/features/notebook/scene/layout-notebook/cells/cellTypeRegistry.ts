import { type ComponentType } from 'react';

import { Registry, type RegistryItem } from '@grafana/data';
import { type CellContentKind } from 'app/features/notebook/types';

import { CodeCell } from './CodeCell';
import { MarkdownCell } from './MarkdownCell';

export interface CellTypeRegistryItem extends RegistryItem {
  // id matches CellContentKind['kind'] ('Markdown' | 'Code'); each renderer narrows
  // the content by that kind. `isEditing` is offered to every cell type; a renderer that has
  // nothing to change yet simply does not accept it.
  render: ComponentType<{ content: CellContentKind; isEditing: boolean }>;
}

export const cellTypeRegistry = new Registry<CellTypeRegistryItem>(() => [
  { id: 'Markdown', name: 'Markdown', render: MarkdownCell },
  { id: 'Code', name: 'Code', render: CodeCell },
]);

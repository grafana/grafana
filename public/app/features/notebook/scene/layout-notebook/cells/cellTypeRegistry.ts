import { type ComponentType } from 'react';

import { Registry, type RegistryItem } from '@grafana/data';
import { type CellContentKind } from 'app/features/notebook/types';

import { CodeCell } from './CodeCell';
import { MarkdownCell } from './MarkdownCell';

export interface CellTypeRegistryItem extends RegistryItem {
  // id matches CellContentKind['kind'] ('Markdown' | 'Code'); each renderer narrows
  // the content by that kind.
  render: ComponentType<{ content: CellContentKind }>;
}

export const cellTypeRegistry = new Registry<CellTypeRegistryItem>(() => [
  { id: 'Markdown', name: 'Markdown', render: MarkdownCell },
  { id: 'Code', name: 'Code', render: CodeCell },
]);

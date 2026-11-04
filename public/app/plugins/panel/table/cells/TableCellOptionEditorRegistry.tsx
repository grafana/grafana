import type { ComponentType, ReactNode } from 'react';

import { Field } from '@grafana/ui';
import { highlightOptionSearchTerm } from 'app/features/dashboard/components/PanelEditor/OptionSearchHighlight';

export interface TableCellOptionEditorProps<T> {
  cellOptions: T;
  onChange: (value: T) => void;
  searchQuery?: string;
}

export interface TableCellOptionEditorDefinition<T> {
  id: string;
  name: () => string;
  description?: () => string;
  renderLabel?: (name: string, searchQuery?: string) => ReactNode;
  showIf?: (cellOptions: T) => boolean;
  Editor: ComponentType<TableCellOptionEditorProps<T>>;
}

export function getVisibleCellOptionEditors<T>(registry: Array<TableCellOptionEditorDefinition<T>>, cellOptions: T) {
  return registry.filter((item) => !item.showIf || item.showIf(cellOptions));
}

export function getCellOptionEditorSearchTerms<T>(registry: Array<TableCellOptionEditorDefinition<T>>, cellOptions: T) {
  return getVisibleCellOptionEditors(registry, cellOptions).map(({ name }) => name());
}

export function renderCellOptionEditors<T>(
  registry: Array<TableCellOptionEditorDefinition<T>>,
  props: TableCellOptionEditorProps<T>
): ReactNode {
  return getVisibleCellOptionEditors(registry, props.cellOptions).map(
    ({ id, name: getName, description: getDescription, Editor, renderLabel }) => {
      const name = getName();
      const description = getDescription?.();
      return (
        <Field key={id} noMargin label={itemLabel(name, props.searchQuery, renderLabel)} description={description}>
          <Editor {...props} />
        </Field>
      );
    }
  );
}

function itemLabel(name: string, searchQuery?: string, renderLabel?: (name: string, query?: string) => ReactNode) {
  if (renderLabel) {
    return renderLabel(name, searchQuery);
  }

  return searchQuery ? highlightOptionSearchTerm(name, searchQuery) : name;
}

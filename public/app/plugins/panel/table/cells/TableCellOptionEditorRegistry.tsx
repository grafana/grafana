import { useId, type ComponentType, type ReactNode } from 'react';

import { Field, Label } from '@grafana/ui';
import { highlightOptionSearchTerm } from 'app/features/dashboard/components/PanelEditor/OptionSearchHighlight';

export interface TableCellOptionEditorProps<T> {
  cellOptions: T;
  onChange: (value: T) => void;
  searchQuery?: string;
  id?: string;
  labelId?: string;
}

export interface TableCellOptionEditorDefinition<T> {
  id: string;
  name: () => string;
  description?: () => string;
  renderLabel?: (name: string, searchQuery?: string, htmlFor?: string, labelId?: string) => ReactNode;
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
  return getVisibleCellOptionEditors(registry, props.cellOptions).map((item) => (
    <CellOptionEditor key={item.id} item={item} props={props} />
  ));
}

function CellOptionEditor<T>({
  item,
  props,
}: {
  item: TableCellOptionEditorDefinition<T>;
  props: TableCellOptionEditorProps<T>;
}) {
  const inputId = `${useId()}-${item.id}`;
  const labelId = `${inputId}-label`;
  const name = item.name();
  const description = item.description?.();
  const label = item.renderLabel ? (
    item.renderLabel(name, props.searchQuery, inputId, labelId)
  ) : (
    <Label id={labelId} htmlFor={inputId} description={description}>
      {props.searchQuery ? highlightOptionSearchTerm(name, props.searchQuery) : name}
    </Label>
  );

  return (
    <Field noMargin label={label} htmlFor={inputId}>
      <item.Editor {...props} id={inputId} labelId={labelId} />
    </Field>
  );
}

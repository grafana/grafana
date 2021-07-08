import React from 'react';
import { TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { rowsToFieldsTransformer, RowToFieldsTransformOptions } from './rowsToFields';

interface Props extends TransformerUIProps<RowToFieldsTransformOptions> {}

export function RowsToFieldsTransformerEditor(props: Props) {
  return <div></div>;
}

export const rowsToFieldsTransformRegistryItem: TransformerRegistryItem<RowToFieldsTransformOptions> = {
  id: rowsToFieldsTransformer.id,
  editor: RowsToFieldsTransformerEditor,
  transformation: rowsToFieldsTransformer,
  name: rowsToFieldsTransformer.name,
  description: rowsToFieldsTransformer.description,
};

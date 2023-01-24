import memoizeOne from 'memoize-one';

import { DataFrame, Field, FieldType, LinkModel, LogRowModel } from '@grafana/data';

type FieldDef = {
  key: string;
  value: string;
  links?: Array<LinkModel<Field>>;
  fieldIndex: number;
};

/**
 * Returns all fields for log row which consists of fields we parse from the message itself and additional fields
 * found in the dataframe (they may contain links).
 */
export const getAllFields = memoizeOne(
  (
    row: LogRowModel,
    getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>
  ) => {
    const dataframeFields = getDataframeFields(row, getFieldLinks);

    return Object.values(dataframeFields);
  }
);

/**
 * creates fields from the dataframe-fields, adding data-links, when field.config.links exists
 */
export const getDataframeFields = memoizeOne(
  (
    row: LogRowModel,
    getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>
  ): FieldDef[] => {
    return row.dataFrame.fields
      .map((field, index) => ({ ...field, index }))
      .filter((field, index) => !shouldRemoveField(field, index, row))
      .map((field) => {
        const links = getFieldLinks ? getFieldLinks(field, row.rowIndex, row.dataFrame) : [];
        return {
          key: field.name,
          value: field.values.get(row.rowIndex).toString(),
          links: links,
          fieldIndex: field.index,
        };
      });
  }
);

function shouldRemoveField(field: Field, index: number, row: LogRowModel) {
  // Remove field if it is:
  // "labels" field that is in Loki used to store all labels
  if (field.name === 'labels' && field.type === FieldType.other) {
    return true;
  }
  // id and tsNs are arbitrary added fields in the backend and should be hidden in the UI
  if (field.name === 'id' || field.name === 'tsNs') {
    return true;
  }
  // entry field which we are showing as the log message
  if (row.entryFieldIndex === index) {
    return true;
  }
  const firstTimeField = row.dataFrame.fields.find((f) => f.type === FieldType.time);
  if (
    field.name === firstTimeField?.name &&
    field.type === FieldType.time &&
    field.values.get(0) === firstTimeField.values.get(0)
  ) {
    return true;
  }
  // hidden field
  if (field.config.custom?.hidden) {
    return true;
  }
  // field that has empty value (we want to keep 0 or empty string)
  if (field.values.get(row.rowIndex) == null) {
    return true;
  }
  return false;
}

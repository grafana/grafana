import memoizeOne from 'memoize-one';

import { DataFrame, Field, FieldType, LinkModel, LogRowModel } from '@grafana/data';
import { ExploreFieldLinkModel } from 'app/features/explore/utils/links';

export type FieldDef = {
  keys: string[];
  values: string[];
  links?: Array<LinkModel<Field>> | ExploreFieldLinkModel[];
  fieldIndex: number;
};

/**
 * Returns all fields for log row which consists of fields we parse from the message itself and additional fields
 * found in the dataframe (they may contain links).
 */
export const getAllFields = memoizeOne(
  (
    row: LogRowModel,
    getFieldLinks?: (
      field: Field,
      rowIndex: number,
      dataFrame: DataFrame
    ) => Array<LinkModel<Field>> | ExploreFieldLinkModel[]
  ) => {
    const dataframeFields = getDataframeFields(row, getFieldLinks);

    return Object.values(dataframeFields);
  }
);

/**
 * A log line may contain many links that would all need to go on their own logs detail row
 * This iterates through and creates a FieldDef (row) per link.
 */
export const createLogLineLinks = memoizeOne((hiddenFieldsWithLinks: FieldDef[]): FieldDef[] => {
  let fieldsWithLinksFromVariableMap: FieldDef[] = [];
  hiddenFieldsWithLinks.forEach((linkField) => {
    linkField.links?.forEach((link: ExploreFieldLinkModel) => {
      if (link.variables) {
        const variableKeys = link.variables.map((variable) => {
          const varName = variable.variableName;
          const fieldPath = variable.fieldPath ? `.${variable.fieldPath}` : '';
          return `${varName}${fieldPath}`;
        });
        const variableValues = link.variables.map((variable) => (variable.found ? variable.value : ''));
        fieldsWithLinksFromVariableMap.push({
          keys: variableKeys,
          values: variableValues,
          links: [link],
          fieldIndex: linkField.fieldIndex,
        });
      }
    });
  });
  return fieldsWithLinksFromVariableMap;
});

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
          keys: [field.name],
          values: [field.values.get(row.rowIndex).toString()],
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

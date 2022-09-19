import memoizeOne from 'memoize-one';

import { Field, FieldType, getParser, LinkModel, LogRowModel } from '@grafana/data';

import { MAX_CHARACTERS } from './LogRowMessage';

const memoizedGetParser = memoizeOne(getParser);

type FieldDef = {
  key: string;
  value: string;
  links?: Array<LinkModel<Field>>;
  fieldIndex?: number;
};

/**
 * Returns all fields for log row which consists of fields we parse from the message itself and additional fields
 * found in the dataframe (they may contain links).
 */
export const getAllFields = memoizeOne(
  (row: LogRowModel, getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>) => {
    const logMessageFields = parseMessage(row.entry);
    const dataframeFields = getDataframeFields(row, getFieldLinks);
    const fieldsMap = [...dataframeFields, ...logMessageFields].reduce((acc, field) => {
      // Strip enclosing quotes for hashing. When values are parsed from log line the quotes are kept, but if same
      // value is in the dataFrame it will be without the quotes. We treat them here as the same value.
      // We need to handle this scenario:
      // - we use derived-fields in Loki
      // - we name the derived field the same as the parsed-field-name
      // - the same field will appear twice
      //   - in the fields coming from `logMessageFields`
      //   - in the fields coming from `dataframeFields`
      // - but, in the fields coming from `logMessageFields`, there might be doublequotes around the value
      // - we want to "merge" data from both sources, so we remove quotes from the beginning and end
      const value = field.value.replace(/(^")|("$)/g, '');
      const fieldHash = `${field.key}=${value}`;
      if (acc[fieldHash]) {
        acc[fieldHash].links = [...(acc[fieldHash].links || []), ...(field.links || [])];
      } else {
        acc[fieldHash] = field;
      }
      return acc;
    }, {} as { [key: string]: FieldDef });

    const allFields = Object.values(fieldsMap);
    allFields.sort(sortFieldsLinkFirst);

    return allFields;
  }
);

const parseMessage = memoizeOne((rowEntry): FieldDef[] => {
  if (rowEntry.length > MAX_CHARACTERS) {
    return [];
  }
  const parser = memoizedGetParser(rowEntry);
  if (!parser) {
    return [];
  }
  // Use parser to highlight detected fields
  const detectedFields = parser.getFields(rowEntry);
  const fields = detectedFields.map((field) => {
    const key = parser.getLabelFromField(field);
    const value = parser.getValueFromField(field);
    return { key, value };
  });

  return fields;
});

// creates fields from the dataframe-fields, adding data-links, when field.config.links exists
const getDataframeFields = memoizeOne(
  (row: LogRowModel, getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>): FieldDef[] => {
    return row.dataFrame.fields
      .map((field, index) => ({ ...field, index }))
      .filter((field, index) => !shouldRemoveField(field, index, row))
      .map((field) => {
        const links = getFieldLinks ? getFieldLinks(field, row.rowIndex) : [];
        return {
          key: field.name,
          value: field.values.get(row.rowIndex).toString(),
          links: links,
          fieldIndex: field.index,
        };
      });
  }
);

function sortFieldsLinkFirst(fieldA: FieldDef, fieldB: FieldDef) {
  if (fieldA.links?.length && !fieldB.links?.length) {
    return -1;
  }
  if (!fieldA.links?.length && fieldB.links?.length) {
    return 1;
  }
  return fieldA.key > fieldB.key ? 1 : fieldA.key < fieldB.key ? -1 : 0;
}

function shouldRemoveField(field: Field, index: number, row: LogRowModel) {
  // Remove field if it is:
  // "labels" field that is in Loki used to store all labels
  if (field.name === 'labels' && field.type === FieldType.other) {
    return true;
  }
  // "id" field which we use for react key
  if (field.name === 'id') {
    return true;
  }
  // entry field which we are showing as the log message
  if (row.entryFieldIndex === index) {
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

import { Field, getParser, LinkModel, LogRowModel } from '@grafana/data';
import memoizeOne from 'memoize-one';

import { MAX_CHARACTERS } from './LogRowMessage';

const memoizedGetParser = memoizeOne(getParser);

type FieldDef = {
  key: string;
  value: string;
  links?: Array<LinkModel<Field>>;
  fieldIndex?: number;
};

/**
 * Returns all fields for log row which consists of fields we parse from the message itself and any derived fields
 * setup in data source config.
 */
export const getAllFields = memoizeOne(
  (row: LogRowModel, getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>) => {
    const fields = parseMessage(row.entry);
    const derivedFields = getDerivedFields(row, getFieldLinks);
    const fieldsMap = [...derivedFields, ...fields].reduce((acc, field) => {
      // Strip enclosing quotes for hashing. When values are parsed from log line the quotes are kept, but if same
      // value is in the dataFrame it will be without the quotes. We treat them here as the same value.
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
  const parsedFields = parser.getFields(rowEntry);
  const fields = parsedFields.map(field => {
    const key = parser.getLabelFromField(field);
    const value = parser.getValueFromField(field);
    return { key, value };
  });

  return fields;
});

const getDerivedFields = memoizeOne(
  (row: LogRowModel, getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>): FieldDef[] => {
    return (
      row.dataFrame.fields
        .map((field, index) => ({ ...field, index }))
        // Remove Id which we use for react key and entry field which we are showing as the log message. Also remove hidden fields.
        .filter(
          (field, index) => !('id' === field.name || row.entryFieldIndex === index || field.config.custom?.hidden)
        )
        // Filter out fields without values. For example in elastic the fields are parsed from the document which can
        // have different structure per row and so the dataframe is pretty sparse.
        .filter(field => {
          const value = field.values.get(row.rowIndex);
          // Not sure exactly what will be the empty value here. And we want to keep 0 as some values can be non
          // string.
          return value !== null && value !== undefined;
        })
        .map(field => {
          const links = getFieldLinks ? getFieldLinks(field, row.rowIndex) : [];
          return {
            key: field.name,
            value: field.values.get(row.rowIndex).toString(),
            links: links,
            fieldIndex: field.index,
          };
        })
    );
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

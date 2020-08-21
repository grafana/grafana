import { Field, getParser, LinkModel } from '@grafana/data';
import memoizeOne from 'memoize-one';

import { MAX_CHARACTERS } from './LogRowMessage';

const memoizedGetParser = memoizeOne(getParser);

export type FieldDef = {
  key: string;
  value: string;
  links?: Array<LinkModel<Field>>;
  fieldIndex?: number;
};

export const parseMessage = memoizeOne((rowEntry): FieldDef[] => {
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

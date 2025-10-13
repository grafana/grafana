import { guessFieldTypeFromValue } from '../dataframe/processDataFrame';
import { Field, FieldType } from '../types/dataFrame';

export function makeFieldParser(value: unknown, field: Field) {
  if (!field.type) {
    if (field.name === 'time' || field.name === 'Time') {
      field.type = FieldType.time;
    } else {
      field.type = guessFieldTypeFromValue(value);
    }
  }

  if (field.type === FieldType.number) {
    return (value: string) => {
      return parseFloat(value);
    };
  }

  // Will convert anything that starts with "T" to true
  if (field.type === FieldType.boolean) {
    return (value: string) => {
      return !(value[0] === 'F' || value[0] === 'f' || value[0] === '0');
    };
  }

  // Just pass the string back
  return (value: string) => value;
}

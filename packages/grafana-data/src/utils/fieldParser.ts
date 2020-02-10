import { Field, FieldType } from '../types/dataFrame';
import { guessFieldTypeFromValue } from '../dataframe/processDataFrame';

export function makeFieldParser(value: any, field: Field): (value: string) => any {
  let type = field.type;
  if (!type || !type.value) {
    type = {
      value: guessFieldTypeFromValue(value),
    };
  }

  if (type.value === FieldType.number) {
    return (value: string) => {
      return parseFloat(value);
    };
  }

  // Will convert anything that starts with "T" to true
  if (type.value === FieldType.boolean) {
    return (value: string) => {
      return !(value[0] === 'F' || value[0] === 'f' || value[0] === '0');
    };
  }

  // Just pass the string back
  return (value: string) => value;
}

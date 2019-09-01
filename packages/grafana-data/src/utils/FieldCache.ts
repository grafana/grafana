import { Field, FieldType, DataFrame } from '../types/dataFrame';
import { guessFieldTypeForField } from './processDataFrame';

export class FieldCache {
  fields: Field[] = [];

  private fieldByName: {
    [key: string]: Field;
  } = {};

  private fieldByType: {
    [key: string]: Field[];
  } = {};

  constructor(private data: DataFrame) {
    this.fields = data.fields;

    for (const field of data.fields) {
      // Make sure it has a type
      if (field.type === FieldType.other) {
        const t = guessFieldTypeForField(field);
        if (t) {
          field.type = t;
        }
      }

      if (!this.fieldByType[field.type]) {
        this.fieldByType[field.type] = [];
      }

      this.fieldByType[field.type].push(field);

      if (this.fieldByName[field.name]) {
        console.warn('Duplicate field names in DataFrame: ', field.name);
      } else {
        this.fieldByName[field.name] = field;
      }
    }
  }

  getFields(type?: FieldType): Field[] {
    if (!type) {
      return [...this.data.fields]; // All fields
    }

    const fields = this.fieldByType[type];

    if (fields) {
      return [...fields];
    }

    return [];
  }

  hasFieldOfType(type: FieldType): boolean {
    const types = this.fieldByType[type];
    return types && types.length > 0;
  }

  getFirstFieldOfType(type: FieldType): Field | undefined {
    const arr = this.fieldByType[type];

    if (arr && arr.length > 0) {
      return arr[0];
    }

    return undefined;
  }

  hasFieldNamed(name: string): boolean {
    return !!this.fieldByName[name];
  }

  /**
   * Returns the first field with the given name.
   */
  getFieldByName(name: string): Field | undefined {
    return this.fieldByName[name];
  }
}

import { Field, DataFrame, FieldType, guessFieldTypeForField } from '../index';

export interface FieldWithIndex extends Field {
  index: number;
}

export class FieldCache {
  fields: FieldWithIndex[] = [];

  private fieldByName: { [key: string]: FieldWithIndex } = {};
  private fieldByType: { [key: string]: FieldWithIndex[] } = {};

  constructor(data: DataFrame) {
    this.fields = data.fields.map((field, idx) => ({
      ...field,
      index: idx,
    }));

    for (let i = 0; i < data.fields.length; i++) {
      const field = data.fields[i];
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
      this.fieldByType[field.type].push({
        ...field,
        index: i,
      });

      if (this.fieldByName[field.name]) {
        console.warn('Duplicate field names in DataFrame: ', field.name);
      } else {
        this.fieldByName[field.name] = { ...field, index: i };
      }
    }
  }

  getFields(type?: FieldType): FieldWithIndex[] {
    if (!type) {
      return [...this.fields]; // All fields
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

  getFirstFieldOfType(type: FieldType, includeHidden = false): FieldWithIndex | undefined {
    const fields = this.fieldByType[type];
    const firstField = fields.find(field => includeHidden || !field.config.custom?.hidden);
    return firstField;
  }

  hasFieldNamed(name: string): boolean {
    return !!this.fieldByName[name];
  }

  hasFieldWithNameAndType(name: string, type: FieldType): boolean {
    return !!this.fieldByName[name] && this.fieldByType[type].filter(field => field.name === name).length > 0;
  }

  /**
   * Returns the first field with the given name.
   */
  getFieldByName(name: string): FieldWithIndex | undefined {
    return this.fieldByName[name];
  }
}

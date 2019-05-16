import { Field, FieldType } from '../types/index';

export interface IndexedField extends Field {
  index: number;
}

export class FieldCache {
  private fields: Field[];
  private fieldIndexByName: { [key: string]: number };
  private fieldIndexByType: { [key: string]: number[] };

  constructor(fields?: Field[]) {
    this.fields = [];
    this.fieldIndexByName = {};
    this.fieldIndexByType = {};
    this.fieldIndexByType[FieldType.time] = [];
    this.fieldIndexByType[FieldType.string] = [];
    this.fieldIndexByType[FieldType.number] = [];
    this.fieldIndexByType[FieldType.boolean] = [];
    this.fieldIndexByType[FieldType.other] = [];

    if (fields) {
      for (let n = 0; n < fields.length; n++) {
        const field = fields[n];
        this.addField(field);
      }
    }
  }

  addField(field: Field) {
    this.fields.push({
      type: FieldType.other,
      ...field,
    });
    const index = this.fields.length - 1;
    this.fieldIndexByName[field.name] = index;
    this.fieldIndexByType[field.type || FieldType.other].push(index);
  }

  hasFieldOfType(type: FieldType): boolean {
    return this.fieldIndexByType[type] && this.fieldIndexByType[type].length > 0;
  }

  getFields(type?: FieldType): IndexedField[] {
    const fields: IndexedField[] = [];
    for (let index = 0; index < this.fields.length; index++) {
      const field = this.fields[index];

      if (!type || field.type === type) {
        fields.push({ ...field, index });
      }
    }

    return fields;
  }

  getFieldByIndex(index: number): IndexedField | null {
    return this.fields[index] ? { ...this.fields[index], index } : null;
  }

  getFirstFieldOfType(type: FieldType): IndexedField | null {
    return this.hasFieldOfType(type)
      ? { ...this.fields[this.fieldIndexByType[type][0]], index: this.fieldIndexByType[type][0] }
      : null;
  }

  hasFieldNamed(name: string): boolean {
    return this.fieldIndexByName[name] !== undefined;
  }

  getFieldByName(name: string): IndexedField | null {
    return this.hasFieldNamed(name)
      ? { ...this.fields[this.fieldIndexByName[name]], index: this.fieldIndexByName[name] }
      : null;
  }
}

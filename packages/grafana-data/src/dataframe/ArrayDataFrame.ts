import { Field, FieldType, DataFrame } from '../types/dataFrame';
import { vectorToArray } from '../vector/vectorToArray';
import { Vector, QueryResultMeta } from '../types';
import { guessFieldTypeFromNameAndValue, toDataFrameDTO } from './processDataFrame';
import { FunctionalVector } from '../vector/FunctionalVector';

export type ValueConverter<T = any> = (val: any) => T;

const NOOP: ValueConverter = v => v;

class ArrayPropertyVector<T = any> implements Vector<T> {
  converter = NOOP;

  constructor(private source: any[], private prop: string) {}

  get length(): number {
    return this.source.length;
  }

  get(index: number): T {
    return this.converter(this.source[index][this.prop]);
  }

  toArray(): T[] {
    return vectorToArray(this);
  }

  toJSON(): T[] {
    return vectorToArray(this);
  }
}

/**
 * The ArrayDataFrame takes an array of objects and presents it as a DataFrame
 *
 * @alpha
 */
export class ArrayDataFrame<T = any> extends FunctionalVector<T> implements DataFrame {
  name?: string;
  refId?: string;
  meta?: QueryResultMeta;

  private theFields: Field[] = [];

  constructor(private source: Array<T>, names?: string[]) {
    super();

    const first: any = source.length ? source[0] : {};
    if (names) {
      this.theFields = names.map(name => {
        return {
          name,
          type: guessFieldTypeFromNameAndValue(name, first[name]),
          config: {},
          values: new ArrayPropertyVector(source, name),
        };
      });
    } else {
      this.setFieldsFromObject(first);
    }
  }

  /**
   * Add a field for each property in the object.  This will guess the type
   */
  setFieldsFromObject(obj: any) {
    this.theFields = Object.keys(obj).map(name => {
      return {
        name,
        type: guessFieldTypeFromNameAndValue(name, obj[name]),
        config: {},
        values: new ArrayPropertyVector(this.source, name),
      };
    });
  }

  /**
   * Configure how the object property is passed to the data frame
   */
  setFieldType(name: string, type: FieldType, converter?: ValueConverter): Field {
    let field = this.fields.find(f => f.name === name);
    if (field) {
      field.type = type;
    } else {
      field = {
        name,
        type,
        config: {},
        values: new ArrayPropertyVector(this.source, name),
      };
      this.fields.push(field);
    }
    (field.values as any).converter = converter ?? NOOP;
    return field;
  }

  get fields(): Field[] {
    return this.theFields;
  }

  // Defined for Vector interface
  get length() {
    return this.source.length;
  }

  /**
   * Get an object with a property for each field in the DataFrame
   */
  get(idx: number): T {
    return this.source[idx];
  }

  /**
   * The simplified JSON values used in JSON.stringify()
   */
  toJSON() {
    return toDataFrameDTO(this);
  }
}

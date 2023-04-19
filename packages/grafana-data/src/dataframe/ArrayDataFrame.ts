import { makeArrayIndexableVector, QueryResultMeta } from '../types';
import { Field, FieldType, DataFrame } from '../types/dataFrame';
import { FunctionalVector } from '../vector/FunctionalVector';
import { vectorToArray } from '../vector/vectorToArray';

import { guessFieldTypeFromNameAndValue, toDataFrameDTO } from './processDataFrame';

/** @public */
export type ValueConverter<T = any> = (val: unknown) => T;

const NOOP: ValueConverter = (v) => v;

class ArrayPropertyVector<T = any> extends FunctionalVector<T> {
  converter = NOOP;

  constructor(private source: any[], private prop: string) {
    super();
  }

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

  fields: Field[] = [];
  length = 0;

  constructor(private source: T[], names?: string[]) {
    super();

    this.length = source.length;
    const first: any = source.length ? source[0] : {};
    if (names) {
      this.fields = names.map((name) => {
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
    return makeArrayIndexableVector(this);
  }

  /**
   * Add a field for each property in the object.  This will guess the type
   */
  setFieldsFromObject(obj: Record<string, unknown>) {
    this.fields = Object.keys(obj).map((name) => {
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
    let field = this.fields.find((f) => f.name === name);
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

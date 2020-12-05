import { Field, FieldType } from '../types';
import { FunctionalVector } from './FunctionalVector';

export class IndexVector extends FunctionalVector<number> {
  constructor(private len: number) {
    super();
  }

  get length() {
    return this.len;
  }

  get(index: number): number {
    return index;
  }

  static newField(len: number): Field<number> {
    return {
      name: '',
      values: new IndexVector(len),
      type: FieldType.number,
      config: {
        min: 0,
        max: len,
      },
    };
  }
}

import { makeArrayIndexableVector, Vector } from '../types';

import { FunctionalVector } from './FunctionalVector';
import { vectorToArray } from './vectorToArray';

/**
 * RowVector makes the row values look like a vector
 * @internal
 * @deprecated use a simple Arrays
 */
export class RowVector extends FunctionalVector<number> {
  constructor(private columns: Vector[]) {
    super();
    return makeArrayIndexableVector(this);
  }

  rowIndex = 0;

  get length(): number {
    return this.columns.length;
  }

  get(index: number): number {
    return this.columns[index].get(this.rowIndex);
  }

  toArray(): number[] {
    return vectorToArray(this);
  }

  toJSON(): number[] {
    return vectorToArray(this);
  }
}

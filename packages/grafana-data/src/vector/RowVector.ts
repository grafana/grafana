import { Vector } from '../types';

import { vectorToArray } from './vectorToArray';

/**
 * RowVector makes the row values look like a vector
 * @internal
 */
export class RowVector implements Vector {
  constructor(private columns: Vector[]) {}

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

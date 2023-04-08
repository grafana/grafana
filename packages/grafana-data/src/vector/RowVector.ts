import { Vector } from '../types';

import { FunctionalVector } from './FunctionalVector';
import { vectorToArray } from './vectorToArray';

/**
 * RowVector makes the row values look like a vector
 * @internal
 */
export class RowVector extends FunctionalVector<number> {
  constructor(private columns: Vector[]) {
    super();
  }

  rowIndex = 0;

  get length(): number {
    return this.columns.length;
  }

  push(...vals: number[]): void {
    throw 'unsupported operation';
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

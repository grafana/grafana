import { Vector } from '../types/vector';
import { BinaryOperation } from '../utils/binaryOperators';

import { vectorToArray } from './vectorToArray';

/**
 * @public
 */
export class BinaryOperationVector implements Vector<number> {
  constructor(private left: Vector<number>, private right: Vector<number>, private operation: BinaryOperation) {}

  get length(): number {
    return this.left.length;
  }

  get(index: number): number {
    return this.operation(this.left.get(index), this.right.get(index));
  }

  toArray(): number[] {
    return vectorToArray(this);
  }

  toJSON(): number[] {
    return vectorToArray(this);
  }
}

import { makeArrayIndexableVector, Vector } from '../types/vector';
import { BinaryOperation } from '../utils/binaryOperators';

import { FunctionalVector } from './FunctionalVector';
import { vectorToArray } from './vectorToArray';

/**
 * @public
 * @deprecated use a simple Arrays
 */
export class BinaryOperationVector extends FunctionalVector<number> {
  constructor(private left: Vector<number>, private right: Vector<number>, private operation: BinaryOperation) {
    super();
    return makeArrayIndexableVector(this);
  }

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

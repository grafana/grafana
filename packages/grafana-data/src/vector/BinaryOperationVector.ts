import { Vector } from '../types/vector';
import { BinaryOperation } from '../utils/binaryOperators';

/**
 * @public
 * @deprecated use a simple Arrays
 */
export class BinaryOperationVector extends Array<number> {
  constructor(left: Vector<number>, right: Vector<number>, operation: BinaryOperation) {
    super();

    const arr = new Array(left.length);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = operation(left[i], right[i]);
    }
    return arr as BinaryOperationVector;
  }
}

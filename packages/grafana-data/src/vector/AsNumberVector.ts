import { Vector } from '../types';

/**
 * This will force all values to be numbers
 *
 * @public
 * @deprecated use a simple Arrays
 */
export class AsNumberVector extends Array<number> {
  constructor(field: Vector) {
    super();
    return field.map((v) => +v) as AsNumberVector;
  }
}

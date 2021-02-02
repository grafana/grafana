import { Vector } from '../types';
import { FunctionalVector } from './FunctionalVector';

export class AsNumberVector extends FunctionalVector<number> {
  constructor(private field: Vector) {
    super();
  }

  get length() {
    return this.field.length;
  }

  get(index: number) {
    return +this.field.get(index);
  }
}

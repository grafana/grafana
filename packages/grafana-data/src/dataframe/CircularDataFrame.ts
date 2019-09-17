import { MutableDataFrame } from './MutableDataFrame';
import { CircularVector } from '../vector/CircularVector';

interface CircularOptions {
  append?: 'head' | 'tail';
  capacity?: number;
}

/**
 * This dataframe can have values constantly added, and will never
 * exceed the given capacity
 */
export class CircularDataFrame<T = any> extends MutableDataFrame<T> {
  constructor(options: CircularOptions) {
    super(undefined, (buffer?: any[]) => {
      return new CircularVector({
        ...options,
        buffer,
      });
    });
  }
}

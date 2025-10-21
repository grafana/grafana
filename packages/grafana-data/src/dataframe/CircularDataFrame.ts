import { MutableDataFrame } from './MutableDataFrame';

interface CircularOptions {
  append?: 'head' | 'tail';
  capacity?: number;
}

/**
 * This dataframe can have values constantly added, and will never
 * exceed the given capacity
 */
export class CircularDataFrame<T = unknown> extends MutableDataFrame<T> {
  constructor(options: CircularOptions) {
    super(undefined, (buffer) => {
      return [{ ...options, buffer }];
    });
  }
}

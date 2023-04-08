import { DisplayProcessor } from '../types';
import { Vector } from '../types/vector';
import { formattedValueToString } from '../valueFormats';

import { FunctionalVector } from './FunctionalVector';

/**
 * @public
 */
export class FormattedVector<T = any> extends FunctionalVector<string> {
  constructor(private source: Vector<T>, private formatter: DisplayProcessor) {
    super();
  }

  get length() {
    return this.source.length;
  }

  push(...vals: string[]): void {
    throw 'unsupported operation';
  }

  get(index: number): string {
    const v = this.source.get(index);
    return formattedValueToString(this.formatter(v));
  }
}

import { Vector } from '../types/vector';
import { DisplayProcessor } from '../types';
import { formattedValueToString } from '../valueFormats';
import { vectorToArray } from './vectorToArray';

export class FormattedVector<T = any> implements Vector<string> {
  constructor(private source: Vector<T>, private formatter: DisplayProcessor) {}

  get length() {
    return this.source.length;
  }

  get(index: number): string {
    const v = this.source.get(index);
    return formattedValueToString(this.formatter(v));
  }

  toArray(): string[] {
    return vectorToArray(this);
  }

  toJSON(): string[] {
    return this.toArray();
  }
}

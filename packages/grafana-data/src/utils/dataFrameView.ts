import { DataFrame, Vector } from '../types/index';

export class DataFrameView<T = any> implements Vector<T> {
  private index = 0;
  private obj: T;

  constructor(private data: DataFrame) {
    const obj = ({} as unknown) as T;
    for (let i = 0; i < data.fields.length; i++) {
      const field = data.fields[i];
      const getter = () => {
        return field.values.get(this.index);
      };
      if (!(obj as any).hasOwnProperty(field.name)) {
        Object.defineProperty(obj, field.name, {
          enumerable: true, // Shows up as enumerable property
          get: getter,
        });
      }
      Object.defineProperty(obj, i, {
        enumerable: false, // Don't enumerate array index
        get: getter,
      });
    }
    this.obj = obj;
  }

  get length() {
    return this.data.length;
  }

  get(idx: number) {
    this.index = idx;
    return this.obj;
  }

  toJSON(): T[] {
    console.warn('not really implemented');
    return [];
  }
}

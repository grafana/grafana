import { DataFrame } from '../types/dataFrame';
import { DisplayProcessor } from '../types';
import { FunctionalVector } from '../vector/FunctionalVector';

/**
 * This abstraction will present the contents of a DataFrame as if
 * it were a well typed javascript object Vector.
 *
 * @remarks
 * The {@link DataFrameView.get} is optimized for use in a loop and will return same object.
 * See function for more details.
 *
 * @typeParam T - Type of object stored in the DataFrame.
 * @beta
 */
export class DataFrameView<T = any> extends FunctionalVector<T> {
  private index = 0;
  private obj: T;

  constructor(private data: DataFrame) {
    super();
    const obj = ({} as unknown) as T;

    for (let i = 0; i < data.fields.length; i++) {
      const field = data.fields[i];
      const getter = () => field.values.get(this.index);

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

  get dataFrame() {
    return this.data;
  }

  get length() {
    return this.data.length;
  }

  /**
   * Helper function to return the {@link DisplayProcessor} for a given field column.
   * @param colIndex - the field column index for the data frame.
   */
  getFieldDisplayProcessor(colIndex: number): DisplayProcessor | null {
    if (!this.dataFrame || !this.dataFrame.fields) {
      return null;
    }

    const field = this.dataFrame.fields[colIndex];

    if (!field || !field.display) {
      return null;
    }

    return field.display;
  }

  /**
   * The contents of the object returned from this function
   * are optimized for use in a loop. All calls return the same object
   * but the index has changed.
   *
   * @example
   * ```typescript
   *   // `first`, `second` and `third` will all point to the same contents at index 2:
   *   const first = view.get(0);
   *   const second = view.get(1);
   *   const third = view.get(2);
   *
   *   // If you need three different objects, consider something like:
   *   const first = { ...view.get(0) };
   *   const second = { ...view.get(1) };
   *   const third = { ...view.get(2) };
   * ```
   * @param idx - The index of the object you currently are inspecting
   */
  get(idx: number) {
    this.index = idx;
    return this.obj;
  }

  toArray(): T[] {
    return new Array(this.data.length)
      .fill(0) // Needs to make a full copy
      .map((_, i) => ({ ...this.get(i) }));
  }
}

import { type SelectableValue } from '../types/select';

/**
 * Converts a single value into a `SelectableValue`, using the value itself as the label.
 * Idiomatic array usage is `values.map(toOption)`; see `toOptions` for a one-call wrapper.
 */
export const toOption = <T>(value: T): SelectableValue<T> => ({ label: String(value), value });

/**
 * Converts an array of values into `SelectableValue` options, using each value as its own label.
 * Replaces the common inline `values.map((v) => ({ value: v, label: v }))` pattern.
 */
export const toOptions = <T>(values: T[]): Array<SelectableValue<T>> => values.map((value) => toOption(value));

/**
 * Converts a TypeScript enum into `SelectableValue` options.
 *
 * Unlike `Object.values(MyEnum).map(toOption)`, this safely handles numeric enums, whose runtime
 * object contains reverse-mapping keys (e.g. `enum E { A }` yields `{ '0': 'A', A: 0 }`, so
 * `Object.values(E)` is `['A', 0]`). Those reverse-mapped entries are filtered out here.
 *
 * Pass `getLabel` when the label should differ from the value (e.g. a formatted or translated name).
 */
export const enumToOptions = <T extends string | number>(
  enumObject: Record<string, T>,
  getLabel?: (value: T) => string
): Array<SelectableValue<T>> =>
  Object.keys(enumObject)
    // Numeric enums add reverse-mapping keys ('0', '1', ...); drop them so only members remain.
    .filter((key) => isNaN(Number(key)))
    .map((key) => {
      const value = enumObject[key];
      return { value, label: getLabel ? getLabel(value) : String(value) };
    });

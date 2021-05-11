export function unwrap<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error('value must not be nullish');
  }
  return value;
}

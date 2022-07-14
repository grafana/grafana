export function assertIsDefined<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error(`Expected value to not be null but got ${typeof value}`);
  }

  return value;
}

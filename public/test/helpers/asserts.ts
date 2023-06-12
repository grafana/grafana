export function assertInstanceOf<T extends { new (...args: unknown[]): InstanceType<T> }>(
  value: unknown,
  type: T
): InstanceType<T> {
  if (!(value instanceof type)) {
    throw new Error(`Expected value to be an instanceof ${typeof type} but got ${typeof value}`);
  }

  return value;
}

export function assertIsDefined<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error(`Expected value to not be null but got ${typeof value}`);
  }

  return value;
}

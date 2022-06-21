export function assertInstanceOf<T extends { new (...args: unknown[]): InstanceType<T> }>(
  value: unknown,
  type: T
): InstanceType<T> {
  if (!(value instanceof type)) {
    throw new Error(`Expected value to be an instanceof ${typeof type} but got ${typeof value}`);
  }

  return value;
}

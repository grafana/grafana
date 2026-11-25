// SWC exports are live getters. Spreading a partially initialized module in a mock
// factory can read a binding in an import cycle before initialization. Inherit the
// actual exports instead, keeping overrides own properties and actual exports live.
// Real exports are inherited, not own keys; do not use this for consumers that
// enumerate or spread the mocked module's exports.
// One mock per actual module is retained; use a fresh module registry if a test
// intentionally installs a different factory for the same actual module.
const mocks = new WeakMap<object, object>();

export function partialMock<T extends object>(actual: T, overrides: Partial<T>): T {
  // Reentrant Jest factories can receive the same actual module before it has
  // initialized. Keep one set of overrides for both production and test imports.
  const existing = mocks.get(actual);
  if (existing) {
    return existing as T;
  }
  mocks.set(actual, overrides);
  return Object.setPrototypeOf(overrides, actual);
}

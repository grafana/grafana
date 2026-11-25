import path from 'node:path';

/**
 * Returns a writable copy of a module for a `jest.mock` factory, so tests can `jest.spyOn` its exports.
 * ESM exports are read-only. `__esModule` makes the test and the code under test import the same copy.
 * Relative paths resolve from the test file, like the `jest.mock` path.
 *
 * jest.mock('./utils', () => makeSpyable('./utils'));
 */
export function makeSpyable(moduleName: string): Record<string, unknown> {
  const testPath = expect.getState().testPath;
  const resolved =
    moduleName.startsWith('.') && testPath ? path.resolve(path.dirname(testPath), moduleName) : moduleName;
  return { __esModule: true, ...jest.requireActual(resolved) };
}

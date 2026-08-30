import { ALLOWED_FUNCTIONS } from '../../utils/metaSqlExpr';

import { FUNCTION_SIGNATURES } from './functionSignatures';

describe('FUNCTION_SIGNATURES', () => {
  const names = FUNCTION_SIGNATURES.map((signature) => signature.name);

  it('has no duplicate function names', () => {
    expect(new Set(names).size).toBe(names.length);
  });

  it('only defines signatures for allowed functions', () => {
    const allowed = new Set(ALLOWED_FUNCTIONS);
    expect(names.filter((name) => !allowed.has(name))).toEqual([]);
  });

  it('covers every allowed function', () => {
    const covered = new Set(names);
    expect(ALLOWED_FUNCTIONS.filter((name) => !covered.has(name))).toEqual([]);
  });

  it('gives every signature a name and a parameters array', () => {
    for (const signature of FUNCTION_SIGNATURES) {
      expect(signature.name).toBeTruthy();
      expect(Array.isArray(signature.parameters)).toBe(true);
    }
  });
});

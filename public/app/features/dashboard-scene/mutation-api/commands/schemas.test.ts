import { payloads } from './schemas';

// A minimal, valid QueryVariable definition for the ADD_VARIABLE payload.
function variable(name: unknown) {
  return {
    kind: 'QueryVariable',
    spec: { name, query: { group: 'prometheus', spec: {} } },
  };
}

describe('variable payloads require a non-empty name', () => {
  it('ADD_VARIABLE rejects an omitted name', () => {
    const result = payloads.addVariable.safeParse({ variable: { kind: 'QueryVariable', spec: {} } });
    expect(result.success).toBe(false);
  });

  it('ADD_VARIABLE rejects an empty / whitespace name', () => {
    expect(payloads.addVariable.safeParse({ variable: variable('') }).success).toBe(false);
    expect(payloads.addVariable.safeParse({ variable: variable('   ') }).success).toBe(false);
  });

  it('ADD_VARIABLE accepts a named variable and defaults the query kind', () => {
    const result = payloads.addVariable.safeParse({ variable: variable('region') });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const parsed = result.data.variable;
    if (parsed.kind !== 'QueryVariable') {
      throw new Error('expected QueryVariable');
    }
    expect(parsed.spec.name).toBe('region');
    expect(parsed.spec.query.kind).toBe('DataQuery');
  });

  it('UPDATE_VARIABLE rejects an empty name on the new definition', () => {
    const result = payloads.updateVariable.safeParse({ name: 'region', variable: variable('') });
    expect(result.success).toBe(false);
  });
});

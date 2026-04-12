import { deepMerge } from './deepMerge';

describe('deepMerge', () => {
  it('should merge flat properties', () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, { b: 3, c: 4 } as Record<string, unknown>);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should mutate and return the target', () => {
    const target = { a: 1 };
    const result = deepMerge(target, { b: 2 } as Record<string, unknown>);
    expect(result).toBe(target);
  });

  it('should deep merge nested objects', () => {
    const target = { nested: { a: 1, b: 2 } };
    const result = deepMerge(target, { nested: { b: 3, c: 4 } } as Record<string, unknown>);
    expect(result).toEqual({ nested: { a: 1, b: 3, c: 4 } });
  });

  it('should replace arrays instead of concatenating', () => {
    const target = { arr: [1, 2, 3] };
    const result = deepMerge(target, { arr: [4, 5] } as Record<string, unknown>);
    expect(result).toEqual({ arr: [4, 5] });
  });

  it('should handle multiple sources (left to right)', () => {
    const target = { a: 1 } as Record<string, unknown>;
    const result = deepMerge(target, { a: 2, b: 10 }, { a: 3, c: 30 });
    expect(result).toEqual({ a: 3, b: 10, c: 30 });
  });

  it('should skip null and undefined sources', () => {
    const target = { a: 1 };
    const result = deepMerge(target, null as unknown as Record<string, unknown>, undefined as unknown as Record<string, unknown>);
    expect(result).toEqual({ a: 1 });
  });

  it('should not overwrite with undefined values', () => {
    const target = { a: 1, b: 2 } as Record<string, unknown>;
    const result = deepMerge(target, { a: undefined, b: 3 });
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it('should deeply merge more than two levels', () => {
    const target = { l1: { l2: { l3: { a: 1 } } } };
    const result = deepMerge(target, { l1: { l2: { l3: { b: 2 } } } } as Record<string, unknown>);
    expect(result).toEqual({ l1: { l2: { l3: { a: 1, b: 2 } } } });
  });

  it('should overwrite primitives with objects', () => {
    const target = { a: 1 } as Record<string, unknown>;
    const result = deepMerge(target, { a: { nested: true } });
    expect(result).toEqual({ a: { nested: true } });
  });

  it('should overwrite objects with primitives', () => {
    const target = { a: { nested: true } } as Record<string, unknown>;
    const result = deepMerge(target, { a: 42 });
    expect(result).toEqual({ a: 42 });
  });

  it('should merge into an empty target', () => {
    const target = {} as Record<string, unknown>;
    const result = deepMerge(target, { a: 1 }, { b: { c: 2 } });
    expect(result).toEqual({ a: 1, b: { c: 2 } });
  });
});

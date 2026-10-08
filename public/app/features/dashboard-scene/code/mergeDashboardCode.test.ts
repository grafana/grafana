import { mergeDashboardCode } from './mergeDashboardCode';

it('merges edits to separate panel fields and preserves additions and deletions', () => {
  const base = { panel: { title: 'Before', description: 'Remove me', options: { color: 'blue' } } };
  const local = { panel: { title: 'My title', options: { color: 'blue' } } };
  const incoming = {
    panel: { title: 'Before', description: 'Remove me', options: { color: 'red' }, transparent: true },
  };
  expect(mergeDashboardCode(base, local, incoming)).toEqual({
    value: { panel: { title: 'My title', options: { color: 'red' }, transparent: true } },
    conflicts: [],
  });
});

it('treats identical edits as already merged', () => {
  expect(mergeDashboardCode({ title: 'Before' }, { title: 'After' }, { title: 'After' })).toEqual({
    value: { title: 'After' },
    conflicts: [],
  });
});

it('reviews concurrent array edits together rather than matching unstable indices', () => {
  const result = mergeDashboardCode({ items: ['a', 'b'] }, { items: ['b'] }, { items: ['a', 'c'] });
  expect(result).toEqual({
    value: { items: ['b'] },
    conflicts: [{ path: '/items', base: ['a', 'b'], local: ['b'], incoming: ['a', 'c'] }],
  });
});

it('distinguishes a deletion from null and resolves an edit against a deletion', () => {
  const base = { panel: { title: 'Before' }, value: null };
  const local = { value: null };
  const incoming = { panel: { title: 'Assistant' }, value: 7 };
  expect(mergeDashboardCode(base, local, incoming, { '/panel': 'incoming' })).toEqual({
    value: { panel: { title: 'Assistant' }, value: 7 },
    conflicts: [{ path: '/panel', base: { title: 'Before' }, local: undefined, incoming: { title: 'Assistant' } }],
  });
  expect(mergeDashboardCode(base, local, incoming, { '/panel': 'local' }).value).toEqual({ value: 7 });
});

it('escapes JSON pointer paths and treats prototype-like keys as data', () => {
  const result = mergeDashboardCode(
    JSON.parse('{"__proto__":{"value":1},"a/b~c":1}'),
    JSON.parse('{"__proto__":{"value":2},"a/b~c":2}'),
    JSON.parse('{"__proto__":{"value":1},"a/b~c":3}')
  );
  expect(JSON.stringify(result.value)).toBe('{"__proto__":{"value":2},"a/b~c":2}');
  expect(result.conflicts).toEqual([{ path: '/a~1b~0c', base: 1, local: 2, incoming: 3 }]);
});

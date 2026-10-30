import { isEqual } from 'lodash';

import { ALL_SCOPE, canEncodeFilterLabel, encodeFilterLabel, resolveFilterScope } from './filterSelection';

describe('filter selection', () => {
  it.each([
    // The value keeps any colons of its own; only the first one separates.
    { label: { key: 'runbook', value: 'https://example.com' }, encodable: true },
    { label: { key: 'team:name', value: 'Platform' }, encodable: false },
  ])('allows a label only if it reads back unchanged: $label.key', ({ label, encodable }) => {
    expect(canEncodeFilterLabel(label)).toBe(encodable);
    expect(isEqual(resolveFilterScope(encodeFilterLabel(label)), { kind: 'label', label })).toBe(encodable);
  });

  it.each([
    { selection: '', expected: { kind: 'default' } },
    { selection: ALL_SCOPE, expected: { kind: 'all' } },
    // Names no label, e.g. a hand-edited stored value, so it's read as no pick.
    { selection: 'platform', expected: { kind: 'default' } },
  ])('resolves "$selection" to the $expected.kind scope', ({ selection, expected }) => {
    expect(resolveFilterScope(selection)).toEqual(expected);
  });
});

import { isEqual } from 'lodash';

import { canEncodeAlertFilter, encodeAlertFilter, resolveAlertFilter } from './alertFilter';
import { ALL_TEAMS } from './teamFilter';

describe('alert filter selection', () => {
  it.each([
    // The value keeps any colons of its own; only the first one separates.
    { label: { key: 'runbook', value: 'https://example.com' }, encodable: true },
    { label: { key: 'team:name', value: 'Platform' }, encodable: false },
  ])('allows a label only if it reads back unchanged: $label.key', ({ label, encodable }) => {
    expect(canEncodeAlertFilter(label)).toBe(encodable);
    expect(isEqual(resolveAlertFilter(encodeAlertFilter(label)), { kind: 'label', label })).toBe(encodable);
  });

  it.each([
    { selection: '', expected: { kind: 'default' } },
    { selection: ALL_TEAMS, expected: { kind: 'all' } },
    // Names no label, e.g. a hand-edited stored value, so it's read as no pick.
    { selection: 'platform', expected: { kind: 'default' } },
  ])('resolves "$selection" to the $expected.kind scope', ({ selection, expected }) => {
    expect(resolveAlertFilter(selection)).toEqual(expected);
  });
});

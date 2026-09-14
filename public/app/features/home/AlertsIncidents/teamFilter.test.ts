import { act, renderHook } from '@testing-library/react';

import {
  ALL_TEAMS,
  TEAM_FILTER_STORAGE_KEY,
  decodeTeamSelection,
  encodeTeamSelection,
  explicitTeam,
  resolveTeamScope,
  useStoredTeamSelection,
} from './teamFilter';

describe('resolveTeamScope', () => {
  it.each([
    { selection: undefined, expected: { kind: 'default' } },
    { selection: ALL_TEAMS, expected: { kind: 'all' } },
    { selection: 'platform', expected: { kind: 'team', team: 'platform' } },
  ])('resolves $selection to $expected.kind', ({ selection, expected }) => {
    expect(resolveTeamScope(selection)).toEqual(expected);
  });
});

describe('explicitTeam', () => {
  it('returns the team name only for an explicit team pick', () => {
    expect(explicitTeam('platform')).toBe('platform');
    expect(explicitTeam(ALL_TEAMS)).toBeUndefined();
    expect(explicitTeam(undefined)).toBeUndefined();
  });
});

describe('encode/decode', () => {
  it('encodes the default scope as an empty string and decodes it back', () => {
    expect(encodeTeamSelection(undefined)).toBe('');
    expect(decodeTeamSelection('')).toBeUndefined();
  });

  it.each([ALL_TEAMS, 'platform'])('round-trips %s unchanged', (selection) => {
    expect(decodeTeamSelection(encodeTeamSelection(selection))).toBe(selection);
  });
});

describe('useStoredTeamSelection', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads the persisted selection and treats a missing key as the default scope', () => {
    const { result: empty } = renderHook(() => useStoredTeamSelection());
    expect(empty.current[0]).toBeUndefined();

    window.localStorage.setItem(TEAM_FILTER_STORAGE_KEY, 'platform');
    const { result: stored } = renderHook(() => useStoredTeamSelection());
    expect(stored.current[0]).toBe('platform');
  });

  it('persists a team pick and clears the key back to the default scope', () => {
    const { result } = renderHook(() => useStoredTeamSelection());

    act(() => result.current[1]('platform'));
    expect(result.current[0]).toBe('platform');
    expect(window.localStorage.getItem(TEAM_FILTER_STORAGE_KEY)).toBe('platform');

    act(() => result.current[1](undefined));
    expect(result.current[0]).toBeUndefined();
    expect(window.localStorage.getItem(TEAM_FILTER_STORAGE_KEY)).toBe('');
  });
});

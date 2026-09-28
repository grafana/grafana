import { ALL_TEAMS, resolveTeamScope } from './teamFilter';

describe('resolveTeamScope', () => {
  it.each([
    { selection: '', expected: { kind: 'default' } },
    { selection: ALL_TEAMS, expected: { kind: 'all' } },
    { selection: 'platform', expected: { kind: 'team', team: 'platform' } },
  ])('resolves "$selection" to $expected.kind', ({ selection, expected }) => {
    expect(resolveTeamScope(selection)).toEqual(expected);
  });
});

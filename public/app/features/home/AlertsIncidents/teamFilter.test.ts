import { ALL_TEAMS, explicitTeam, resolveTeamScope } from './teamFilter';

describe('resolveTeamScope', () => {
  it.each([
    { selection: '', expected: { kind: 'default' } },
    { selection: ALL_TEAMS, expected: { kind: 'all' } },
    { selection: 'platform', expected: { kind: 'team', team: 'platform' } },
  ])('resolves "$selection" to $expected.kind', ({ selection, expected }) => {
    expect(resolveTeamScope(selection)).toEqual(expected);
  });
});

describe('explicitTeam', () => {
  it('returns the team name only for an explicit team pick', () => {
    expect(explicitTeam('platform')).toBe('platform');
    expect(explicitTeam(ALL_TEAMS)).toBeUndefined();
    expect(explicitTeam('')).toBeUndefined();
  });
});

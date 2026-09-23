import { ALL_TEAMS, decodeIncidentFilter, encodeIncidentFilter, explicitTeam, resolveTeamScope } from './teamFilter';

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

describe('encodeIncidentFilter', () => {
  it('joins the field slug and value with a colon', () => {
    expect(encodeIncidentFilter({ slug: 'squad', value: 'Frontend' })).toBe('squad:Frontend');
  });
});

describe('decodeIncidentFilter', () => {
  it.each([
    { selection: 'squad:Frontend', expected: { slug: 'squad', value: 'Frontend' } },
    // Only the first colon separates: the value keeps any of its own.
    { selection: 'team:Ops: EU', expected: { slug: 'team', value: 'Ops: EU' } },
    // A bare value predates the slug and was always a `team` pick.
    { selection: 'platform', expected: { slug: 'team', value: 'platform' } },
  ])('decodes "$selection" to $expected.slug / $expected.value', ({ selection, expected }) => {
    expect(decodeIncidentFilter(selection)).toEqual(expected);
  });

  it('returns undefined for the unfiltered default scope', () => {
    expect(decodeIncidentFilter('')).toBeUndefined();
  });
});

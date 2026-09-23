import { canonicalIncidentFilter, decodeIncidentFilter, encodeIncidentFilter } from './incidentFilter';

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

describe('canonicalIncidentFilter', () => {
  it.each([
    { selection: '', expected: '' },
    { selection: 'squad:Frontend', expected: 'squad:Frontend' },
    // A legacy bare value gains the slug its live option carries.
    { selection: 'platform', expected: 'team:platform' },
  ])('canonicalizes "$selection" to "$expected"', ({ selection, expected }) => {
    expect(canonicalIncidentFilter(selection)).toBe(expected);
  });
});

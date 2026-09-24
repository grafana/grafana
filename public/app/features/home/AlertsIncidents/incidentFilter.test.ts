import { decodeIncidentFilter, encodeIncidentFilter } from './incidentFilter';

describe('incident filter selection', () => {
  it('round-trips a field value through the stored selection', () => {
    const filter = { slug: 'squad', value: 'Frontend' };
    expect(decodeIncidentFilter(encodeIncidentFilter(filter))).toEqual(filter);
  });

  it.each([
    // Only the first colon separates: the value keeps any of its own.
    { selection: 'team:Ops: EU', expected: { slug: 'team', value: 'Ops: EU' } },
    // '' is the unfiltered default scope; anything without a slug is treated the same.
    { selection: '', expected: undefined },
    { selection: 'platform', expected: undefined },
  ])('decodes "$selection"', ({ selection, expected }) => {
    expect(decodeIncidentFilter(selection)).toEqual(expected);
  });
});

import { parseQueryExplanation } from './queryCoauthoringPrompts';

describe('parseQueryExplanation', () => {
  it.each([
    { name: 'truncated JSON', completion: '{"explanation":"Request rate"' },
    { name: 'null', completion: 'null' },
    { name: 'a JSON string', completion: '"Request rate"' },
    { name: 'a missing explanation', completion: '{"followUps":["Why rate?","Why 5m?"]}' },
    { name: 'a non-string explanation', completion: '{"explanation":42}' },
    { name: 'an empty explanation', completion: '{"explanation":""}' },
    { name: 'a whitespace-only explanation', completion: '{"explanation":"   "}' },
    { name: 'an empty completion', completion: '' },
  ])('uses the fallback without follow-ups for $name', ({ completion }) => {
    expect(parseQueryExplanation(completion, 'The selected query calculates request rate.')).toEqual({
      explanation: 'The selected query calculates request rate.',
      followUps: [],
    });
  });

  it.each([
    { name: 'missing follow-ups', followUps: undefined, expected: [] },
    { name: 'a non-array value', followUps: 'Explain rate', expected: [] },
    { name: 'one valid follow-up', followUps: ['Explain rate'], expected: ['Explain rate'] },
    {
      name: 'more than two valid follow-ups',
      followUps: ['Explain rate', 'Explain 5m', 'Explain labels'],
      expected: ['Explain rate', 'Explain 5m'],
    },
    { name: 'a non-string entry', followUps: ['Explain rate', 42], expected: ['Explain rate'] },
    { name: 'a blank entry', followUps: ['Explain rate', '   '], expected: ['Explain rate'] },
    {
      name: 'a 40-character entry',
      followUps: ['Explain rate', 'Explain abcdefghijklmnopqrstuvwxyz123456'],
      expected: ['Explain rate', 'Explain abcdefghijklmnopqrstuvwxyz123456'],
    },
    {
      name: 'a 41-character entry',
      followUps: ['Explain rate', 'Explain abcdefghijklmnopqrstuvwxyz1234567'],
      expected: ['Explain rate'],
    },
  ])('keeps the answer and valid follow-ups for $name', ({ followUps, expected }) => {
    expect(
      parseQueryExplanation(JSON.stringify({ explanation: '**Request rate** over `5m`.', followUps }), 'Fallback')
    ).toEqual({ explanation: 'Request rate over 5m.', followUps: expected });
  });

  it('normalizes fenced JSON and both valid follow-ups', () => {
    expect(
      parseQueryExplanation(
        '```json\n{"explanation":"**Request rate** over `5m`.","followUps":["Why `rate`?","  Why\\n5m?  "]}\n```',
        'Fallback'
      )
    ).toEqual({ explanation: 'Request rate over 5m.', followUps: ['Why rate?', 'Why 5m?'] });
  });
});

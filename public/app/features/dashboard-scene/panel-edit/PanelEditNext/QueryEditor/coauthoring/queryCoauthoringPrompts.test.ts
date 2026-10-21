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
    { name: 'missing', followUps: undefined },
    { name: 'not an array', followUps: 'Why rate?' },
    { name: 'too few', followUps: ['Why rate?'] },
    { name: 'too many', followUps: ['Why rate?', 'Why 5m?', 'Which labels?'] },
    { name: 'non-string', followUps: ['Why rate?', 42] },
    { name: 'blank', followUps: ['Why rate?', '   '] },
    { name: 'overlong', followUps: ['Why rate?', 'x'.repeat(241)] },
  ])('keeps the answer but omits $name follow-ups', ({ followUps }) => {
    expect(
      parseQueryExplanation(JSON.stringify({ explanation: '**Request rate** over `5m`.', followUps }), 'Fallback')
    ).toEqual({ explanation: 'Request rate over 5m.', followUps: [] });
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

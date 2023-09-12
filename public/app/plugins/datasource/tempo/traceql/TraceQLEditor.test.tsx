import { computeErrorBoundaries } from './TraceQLEditor';

describe('computeErrorMarkers', () => {
  it.each([['{span.http.status_code=200}'], ['{span.a1=1 && span.a2=2} || {resource.a3 = "3"}']])(
    'no error markers for valid query - %s',
    (query: string) => {
      expect(computeErrorBoundaries(query)).toEqual([]);
    }
  );

  it.each([
    ['{blabla}', [[1, 7]]],
    ['{span.http.status_code = }', [[24, 24]]],
    ['{span.foo && }', [[12, 12]]],
    [
      '{span.foo && } || {resource.bar && }',
      [
        [12, 12],
        [34, 34],
      ],
    ],
  ])('error markers for invalid query - %s', (query: string, boundaries: number[][]) => {
    const markers = computeErrorBoundaries(query);
    expect(markers).toMatchObject(createExpectedErrorMarkers(boundaries));
  });
});

const createExpectedErrorMarkers = (boundaries: number[][]) => {
  return boundaries.map((boundary) => ({
    start: boundary[0],
    end: boundary[1],
  }));
};

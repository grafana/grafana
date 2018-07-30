import ResponseTransformer from '../response_transformer';

describe('ResponseTransformer', () => {
  const rt = new ResponseTransformer();

  describe('transformTimeSeriesQueryResult', () => {
    describe('series response', () => {
      const response = {
        data: {
          results: {
            A: {
              refId: 'A',
              meta: { test: 'string' },
              series: [
                {
                  name: 'count',
                  points: [[10, 1432288354]],
                  refId: 'A',
                },
              ],
            },
          },
        },
      };

      it('when transforming response should return expected data', () => {
        const result = rt.transformTimeSeriesQueryResult(response);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].target).toBe('count');
        expect(result.data[0].datapoints).toHaveLength(1);
        expect(result.data[0].refId).toBe('A');
        expect(result.data[0].meta.test).toBe('string');
      });
    });

    describe('table with more than one row response', () => {
      const response = {
        data: {
          results: {
            A: {
              refId: 'A',
              meta: { test: 'string' },
              tables: [
                {
                  cols: ['time', 'v1', 'v2'],
                  rows: [[1432288354, 1, 2], [1432288401, 3, 4]],
                },
              ],
            },
          },
        },
      };

      it('when transforming response should return expected data', () => {
        const result = rt.transformTimeSeriesQueryResult(response);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].type).toBe('table');
        expect(result.data[0].refId).toBe('A');
        expect(result.data[0].meta.test).toBe('string');
        expect(result.data[0].cols).toHaveLength(3);
        expect(result.data[0].rows).toHaveLength(2);
      });
    });

    describe('table with one row response', () => {
      const response = {
        data: {
          results: {
            A: {
              refId: 'A',
              meta: { test: 'string' },
              tables: [
                {
                  rows: [
                    [
                      [
                        {
                          prop1: 1,
                          prop2: 2,
                        },
                        {
                          prop1: 1,
                          prop2: 2,
                        },
                      ],
                      100,
                    ],
                  ],
                },
              ],
            },
          },
        },
      };

      it('when transforming response should return expected data', () => {
        const result = rt.transformTimeSeriesQueryResult(response);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].type).toBe('docs');
        expect(result.data[0].target).toBe('docs');
        expect(result.data[0].datapoints).toHaveLength(2);
        expect(result.data[0].total).toBe(100);
        expect(result.data[0].filterable).toBeTruthy();
      });
    });
  });

  describe('transformAnnotationQueryResponse', () => {
    const annotation = {
      name: 'anno',
    };
    const response = {
      data: {
        results: {
          anno: {
            tables: [
              {
                rows: [[1432288354, 'text', ['tag1', 'tag2 ']]],
              },
            ],
          },
        },
      },
    };

    it('when transforming response should return expected data', () => {
      const result = rt.transformAnnotationQueryResponse(annotation, response);
      expect(result).toHaveLength(1);
      expect(result[0].annotation.name).toBe('anno');
      expect(result[0].time).toBe(1432288354);
      expect(result[0].text).toBe('text');
      expect(result[0].tags).toHaveLength(2);
    });
  });

  describe('transformFieldsQueryResponse', () => {
    const response = {
      data: {
        results: {
          ref: {
            tables: [
              {
                rows: [['@timestamp', 'date']],
              },
            ],
          },
        },
      },
    };

    it('when transforming response should return expected data', () => {
      const result = rt.transformFieldsQueryResponse('ref', response);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('@timestamp');
      expect(result[0].type).toBe('date');
    });
  });

  describe('transformTermsQueryResponse', () => {
    const response = {
      data: {
        results: {
          ref: {
            tables: [
              {
                rows: [['text', 'value']],
              },
            ],
          },
        },
      },
    };

    it('when transforming response should return expected data', () => {
      const result = rt.transformTermsQueryResponse('ref', response);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('text');
      expect(result[0].value).toBe('value');
    });
  });
});

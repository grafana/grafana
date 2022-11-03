import { Column, DataFrameView, Field, FieldCache, KeyValue, MutableDataFrame } from '@grafana/data';
import flatten from 'app/core/utils/flatten';

import { ElasticResponse } from './ElasticResponse';
import { highlightTags } from './queryDef';
import { ElasticsearchQuery } from './types';

describe('ElasticResponse', () => {
  let targets: ElasticsearchQuery[];
  let response: {
    responses: unknown[];
  };
  let result: {
    data: MockedResultData[];
  };

  describe('refId matching', () => {
    // We default to the old table structure to ensure backward compatibility,
    // therefore we only process responses as DataFrames when there's at least one
    // raw_data (new) query type.
    // We should test if refId gets populated wether there's such type of query or not

    const countQuery: MockedQueryData = {
      target: {
        refId: 'COUNT_GROUPBY_DATE_HISTOGRAM',
        metrics: [{ type: 'count', id: 'c_1' }],
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: 'c_2' }],
      } as ElasticsearchQuery,
      response: {
        aggregations: {
          c_2: {
            buckets: [
              {
                doc_count: 10,
                key: 1000,
              },
            ],
          },
        },
      },
    };

    const countGroupByHistogramQuery: MockedQueryData = {
      target: {
        refId: 'COUNT_GROUPBY_HISTOGRAM',
        metrics: [{ type: 'count', id: 'h_3' }],
        bucketAggs: [{ type: 'histogram', field: 'bytes', id: 'h_4' }],
      },
      response: {
        aggregations: {
          h_4: {
            buckets: [{ doc_count: 1, key: 1000 }],
          },
        },
      },
    };

    const rawDocumentQuery: MockedQueryData = {
      target: {
        refId: 'RAW_DOC',
        metrics: [{ type: 'raw_document', id: 'r_5' }],
        bucketAggs: [],
      },
      response: {
        hits: {
          total: 2,
          hits: [
            {
              _id: '5',
              _type: 'type',
              _index: 'index',
              _source: { sourceProp: 'asd' },
              fields: { fieldProp: 'field' },
            },
            {
              _source: { sourceProp: 'asd2' },
              fields: { fieldProp: 'field2' },
            },
          ],
        },
      },
    };

    const percentilesQuery: MockedQueryData = {
      target: {
        refId: 'PERCENTILE',
        metrics: [{ type: 'percentiles', settings: { percents: ['75', '90'] }, id: 'p_1' }],
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: 'p_3' }],
      },
      response: {
        aggregations: {
          p_3: {
            buckets: [
              {
                p_1: { values: { '75': 3.3, '90': 5.5 } },
                doc_count: 10,
                key: 1000,
              },
              {
                p_1: { values: { '75': 2.3, '90': 4.5 } },
                doc_count: 15,
                key: 2000,
              },
            ],
          },
        },
      },
    };

    const extendedStatsQuery: MockedQueryData = {
      target: {
        refId: 'EXTENDEDSTATS',
        metrics: [
          {
            type: 'extended_stats',
            meta: { max: true, std_deviation_bounds_upper: true },
            id: 'e_1',
          },
        ],
        bucketAggs: [
          { type: 'terms', field: 'host', id: 'e_3' },
          { type: 'date_histogram', id: 'e_4' },
        ],
      },
      response: {
        aggregations: {
          e_3: {
            buckets: [
              {
                key: 'server1',
                e_4: {
                  buckets: [
                    {
                      e_1: {
                        max: 10.2,
                        min: 5.5,
                        std_deviation_bounds: { upper: 3, lower: -2 },
                      },
                      doc_count: 10,
                      key: 1000,
                    },
                  ],
                },
              },
              {
                key: 'server2',
                e_4: {
                  buckets: [
                    {
                      e_1: {
                        max: 10.2,
                        min: 5.5,
                        std_deviation_bounds: { upper: 3, lower: -2 },
                      },
                      doc_count: 10,
                      key: 1000,
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    };

    const commonTargets = [
      { ...countQuery.target },
      { ...countGroupByHistogramQuery.target },
      { ...rawDocumentQuery.target },
      { ...percentilesQuery.target },
      { ...extendedStatsQuery.target },
    ];

    const commonResponses = [
      { ...countQuery.response },
      { ...countGroupByHistogramQuery.response },
      { ...rawDocumentQuery.response },
      { ...percentilesQuery.response },
      { ...extendedStatsQuery.response },
    ];

    describe('When processing responses as DataFrames (raw_data query present)', () => {
      beforeEach(() => {
        targets = [
          ...commonTargets,
          // Raw Data Query
          {
            refId: 'D',
            metrics: [{ type: 'raw_data', id: '6' }],
            bucketAggs: [],
          },
        ];

        response = {
          responses: [
            ...commonResponses,
            // Raw Data Query
            {
              hits: {
                total: {
                  relation: 'eq',
                  value: 1,
                },
                hits: [
                  {
                    _id: '6',
                    _type: '_doc',
                    _index: 'index',
                    _source: { sourceProp: 'asd' },
                  },
                ],
              },
            },
          ],
        };

        result = new ElasticResponse(targets, response).getTimeSeries();
      });

      it('should add the correct refId to each returned series', () => {
        expect(result.data[0].refId).toBe(countQuery.target.refId);

        expect(result.data[1].refId).toBe(countGroupByHistogramQuery.target.refId);

        expect(result.data[2].refId).toBe(rawDocumentQuery.target.refId);

        expect(result.data[3].refId).toBe(percentilesQuery.target.refId);
        expect(result.data[4].refId).toBe(percentilesQuery.target.refId);

        expect(result.data[5].refId).toBe(extendedStatsQuery.target.refId);

        // Raw Data query
        expect(result.data[result.data.length - 1].refId).toBe('D');
      });
    });

    describe('When NOT processing responses as DataFrames (raw_data query NOT present)', () => {
      beforeEach(() => {
        targets = [...commonTargets];

        response = {
          responses: [...commonResponses],
        };

        result = new ElasticResponse(targets, response).getTimeSeries();
      });

      it('should add the correct refId to each returned series', () => {
        expect(result.data[0].refId).toBe(countQuery.target.refId);

        expect(result.data[1].refId).toBe(countGroupByHistogramQuery.target.refId);

        expect(result.data[2].refId).toBe(rawDocumentQuery.target.refId);

        expect(result.data[3].refId).toBe(percentilesQuery.target.refId);
        expect(result.data[4].refId).toBe(percentilesQuery.target.refId);

        expect(result.data[5].refId).toBe(extendedStatsQuery.target.refId);
      });
    });
  });

  describe('simple query and count', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'count', id: '1' }],
          bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    doc_count: 10,
                    key: 1000,
                  },
                  {
                    doc_count: 15,
                    key: 2000,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return 1 series', () => {
      expect(result.data.length).toBe(1);
      expect(result.data[0].target).toBe('Count');
      expect(result.data[0].datapoints.length).toBe(2);
      expect(result.data[0].datapoints[0][0]).toBe(10);
      expect(result.data[0].datapoints[0][1]).toBe(1000);
    });
  });

  describe('simple query count & avg aggregation', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { type: 'count', id: '1' },
            { type: 'avg', field: 'value', id: '2' },
          ],
          bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '3': {
                buckets: [
                  {
                    '2': { value: 88 },
                    doc_count: 10,
                    key: 1000,
                  },
                  {
                    '2': { value: 99 },
                    doc_count: 15,
                    key: 2000,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(2);
      expect(result.data[0].datapoints.length).toBe(2);
      expect(result.data[0].datapoints[0][0]).toBe(10);
      expect(result.data[0].datapoints[0][1]).toBe(1000);

      expect(result.data[1].target).toBe('Average value');
      expect(result.data[1].datapoints[0][0]).toBe(88);
      expect(result.data[1].datapoints[1][0]).toBe(99);
    });
  });

  describe('single group by query one metric', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'count', id: '1' }],
          bucketAggs: [
            { type: 'terms', field: 'host', id: '2' },
            { type: 'date_histogram', field: '@timestamp', id: '3' },
          ],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '3': {
                      buckets: [
                        { doc_count: 1, key: 1000 },
                        { doc_count: 3, key: 2000 },
                      ],
                    },
                    doc_count: 4,
                    key: 'server1',
                  },
                  {
                    '3': {
                      buckets: [
                        { doc_count: 2, key: 1000 },
                        { doc_count: 8, key: 2000 },
                      ],
                    },
                    doc_count: 10,
                    key: 'server2',
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(2);
      expect(result.data[0].datapoints.length).toBe(2);
      expect(result.data[0].target).toBe('server1');
      expect(result.data[1].target).toBe('server2');
    });
  });

  describe('single group by query two metrics', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { type: 'count', id: '1' },
            { type: 'avg', field: '@value', id: '4' },
          ],
          bucketAggs: [
            { type: 'terms', field: 'host', id: '2' },
            { type: 'date_histogram', field: '@timestamp', id: '3' },
          ],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '3': {
                      buckets: [
                        { '4': { value: 10 }, doc_count: 1, key: 1000 },
                        { '4': { value: 12 }, doc_count: 3, key: 2000 },
                      ],
                    },
                    doc_count: 4,
                    key: 'server1',
                  },
                  {
                    '3': {
                      buckets: [
                        { '4': { value: 20 }, doc_count: 1, key: 1000 },
                        { '4': { value: 32 }, doc_count: 3, key: 2000 },
                      ],
                    },
                    doc_count: 10,
                    key: 'server2',
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(4);
      expect(result.data[0].datapoints.length).toBe(2);
      expect(result.data[0].target).toBe('server1 Count');
      expect(result.data[1].target).toBe('server1 Average @value');
      expect(result.data[2].target).toBe('server2 Count');
      expect(result.data[3].target).toBe('server2 Average @value');
    });
  });

  describe('with percentiles ', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'percentiles', settings: { percents: ['75', '90'] }, id: '1', field: '@value' }],
          bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '3': {
                buckets: [
                  {
                    '1': { values: { '75': 3.3, '90': 5.5 } },
                    doc_count: 10,
                    key: 1000,
                  },
                  {
                    '1': { values: { '75': 2.3, '90': 4.5 } },
                    doc_count: 15,
                    key: 2000,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(2);
      expect(result.data[0].datapoints.length).toBe(2);
      expect(result.data[0].target).toBe('p75 @value');
      expect(result.data[1].target).toBe('p90 @value');
      expect(result.data[0].datapoints[0][0]).toBe(3.3);
      expect(result.data[0].datapoints[0][1]).toBe(1000);
      expect(result.data[1].datapoints[1][0]).toBe(4.5);
    });
  });

  describe('with extended_stats', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            {
              type: 'extended_stats',
              meta: { max: true, std_deviation_bounds_upper: true },
              id: '1',
              field: '@value',
            },
          ],
          bucketAggs: [
            { type: 'terms', field: 'host', id: '3' },
            { type: 'date_histogram', id: '4' },
          ],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '3': {
                buckets: [
                  {
                    key: 'server1',
                    '4': {
                      buckets: [
                        {
                          '1': {
                            max: 10.2,
                            min: 5.5,
                            std_deviation_bounds: { upper: 3, lower: -2 },
                          },
                          doc_count: 10,
                          key: 1000,
                        },
                      ],
                    },
                  },
                  {
                    key: 'server2',
                    '4': {
                      buckets: [
                        {
                          '1': {
                            max: 10.2,
                            min: 5.5,
                            std_deviation_bounds: { upper: 3, lower: -2 },
                          },
                          doc_count: 10,
                          key: 1000,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return 4 series', () => {
      expect(result.data.length).toBe(4);
      expect(result.data[0].datapoints.length).toBe(1);
      expect(result.data[0].target).toBe('server1 Max @value');
      expect(result.data[1].target).toBe('server1 Std Dev Upper @value');

      expect(result.data[0].datapoints[0][0]).toBe(10.2);
      expect(result.data[1].datapoints[0][0]).toBe(3);
    });
  });

  describe('with top_metrics', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            {
              type: 'top_metrics',
              settings: {
                order: 'top',
                orderBy: '@timestamp',
                metrics: ['@value', '@anotherValue'],
              },
              id: '1',
            },
          ],
          bucketAggs: [{ type: 'date_histogram', id: '2' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    key: new Date('2021-01-01T00:00:00.000Z').valueOf(),
                    key_as_string: '2021-01-01T00:00:00.000Z',
                    '1': {
                      top: [{ sort: ['2021-01-01T00:00:00.000Z'], metrics: { '@value': 1, '@anotherValue': 2 } }],
                    },
                  },
                  {
                    key: new Date('2021-01-01T00:00:10.000Z').valueOf(),
                    key_as_string: '2021-01-01T00:00:10.000Z',
                    '1': {
                      top: [{ sort: ['2021-01-01T00:00:10.000Z'], metrics: { '@value': 1, '@anotherValue': 2 } }],
                    },
                  },
                ],
              },
            },
          },
        ],
      };
    });

    it('should return 2 series', () => {
      const result = new ElasticResponse(targets, response).getTimeSeries();
      expect(result.data.length).toBe(2);

      const firstSeries = result.data[0];
      expect(firstSeries.target).toBe('Top Metrics @value');
      expect(firstSeries.datapoints.length).toBe(2);
      expect(firstSeries.datapoints).toEqual([
        [1, new Date('2021-01-01T00:00:00.000Z').valueOf()],
        [1, new Date('2021-01-01T00:00:10.000Z').valueOf()],
      ]);

      const secondSeries = result.data[1];
      expect(secondSeries.target).toBe('Top Metrics @anotherValue');
      expect(secondSeries.datapoints.length).toBe(2);
      expect(secondSeries.datapoints).toEqual([
        [2, new Date('2021-01-01T00:00:00.000Z').valueOf()],
        [2, new Date('2021-01-01T00:00:10.000Z').valueOf()],
      ]);
    });
  });

  describe('single group by with alias pattern', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'count', id: '1' }],
          alias: '{{term @host}} {{metric}} and {{not_exist}} {{@host}}',
          bucketAggs: [
            { type: 'terms', field: '@host', id: '2' },
            { type: 'date_histogram', field: '@timestamp', id: '3' },
          ],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '3': {
                      buckets: [
                        { doc_count: 1, key: 1000 },
                        { doc_count: 3, key: 2000 },
                      ],
                    },
                    doc_count: 4,
                    key: 'server1',
                  },
                  {
                    '3': {
                      buckets: [
                        { doc_count: 2, key: 1000 },
                        { doc_count: 8, key: 2000 },
                      ],
                    },
                    doc_count: 10,
                    key: 'server2',
                  },
                  {
                    '3': {
                      buckets: [
                        { doc_count: 2, key: 1000 },
                        { doc_count: 8, key: 2000 },
                      ],
                    },
                    doc_count: 10,
                    key: 0,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(3);
      expect(result.data[0].datapoints.length).toBe(2);
      expect(result.data[0].target).toBe('server1 Count and {{not_exist}} server1');
      expect(result.data[1].target).toBe('server2 Count and {{not_exist}} server2');
      expect(result.data[2].target).toBe('0 Count and {{not_exist}} 0');
    });
  });

  describe('histogram response', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'count', id: '1' }],
          bucketAggs: [{ type: 'histogram', field: 'bytes', id: '3' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '3': {
                buckets: [
                  { doc_count: 1, key: 1000 },
                  { doc_count: 3, key: 2000 },
                  { doc_count: 2, key: 1000 },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return table with byte and count', () => {
      expect(result.data[0].rows.length).toBe(3);
      expect(result.data[0].columns).toEqual([{ text: 'bytes', filterable: true }, { text: 'Count' }]);
    });
  });

  describe('with two filters agg', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'count', id: '1' }],
          bucketAggs: [
            {
              id: '2',
              type: 'filters',
              settings: {
                filters: [
                  { query: '@metric:cpu', label: '' },
                  { query: '@metric:logins.count', label: '' },
                ],
              },
            },
            { type: 'date_histogram', field: '@timestamp', id: '3' },
          ],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: {
                  '@metric:cpu': {
                    '3': {
                      buckets: [
                        { doc_count: 1, key: 1000 },
                        { doc_count: 3, key: 2000 },
                      ],
                    },
                  },
                  '@metric:logins.count': {
                    '3': {
                      buckets: [
                        { doc_count: 2, key: 1000 },
                        { doc_count: 8, key: 2000 },
                      ],
                    },
                  },
                },
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return 2 series', () => {
      expect(result.data.length).toBe(2);
      expect(result.data[0].datapoints.length).toBe(2);
      expect(result.data[0].target).toBe('@metric:cpu');
      expect(result.data[1].target).toBe('@metric:logins.count');
    });
  });

  describe('with dropfirst and last aggregation', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { type: 'avg', id: '1', field: '@value' },
            { type: 'count', id: '3' },
          ],
          bucketAggs: [
            {
              id: '2',
              type: 'date_histogram',
              field: 'host',
              settings: { trimEdges: '1' },
            },
          ],
        },
      ];

      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '1': { value: 1000 },
                    key: 1,
                    doc_count: 369,
                  },
                  {
                    '1': { value: 2000 },
                    key: 2,
                    doc_count: 200,
                  },
                  {
                    '1': { value: 2000 },
                    key: 3,
                    doc_count: 200,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should remove first and last value', () => {
      expect(result.data.length).toBe(2);
      expect(result.data[0].datapoints.length).toBe(1);
    });
  });

  describe('No group by time', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { type: 'avg', id: '1', field: '@value' },
            { type: 'count', id: '3' },
          ],
          bucketAggs: [{ id: '2', type: 'terms', field: 'host' }],
        },
      ];

      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '1': { value: 1000 },
                    key: 'server-1',
                    doc_count: 369,
                  },
                  {
                    '1': { value: 2000 },
                    key: 'server-2',
                    doc_count: 200,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return table', () => {
      expect(result.data.length).toBe(1);
      expect(result.data[0].type).toBe('table');
      expect(result.data[0].rows.length).toBe(2);
      expect(result.data[0].rows[0][0]).toBe('server-1');
      expect(result.data[0].rows[0][1]).toBe(1000);
      expect(result.data[0].rows[0][2]).toBe(369);

      expect(result.data[0].rows[1][0]).toBe('server-2');
      expect(result.data[0].rows[1][1]).toBe(2000);
    });
  });

  describe('No group by time with percentiles ', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'percentiles', field: 'value', settings: { percents: ['75', '90'] }, id: '1' }],
          bucketAggs: [{ type: 'terms', field: 'id', id: '3' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '3': {
                buckets: [
                  {
                    '1': { values: { '75': 3.3, '90': 5.5 } },
                    doc_count: 10,
                    key: 'id1',
                  },
                  {
                    '1': { values: { '75': 2.3, '90': 4.5 } },
                    doc_count: 15,
                    key: 'id2',
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return table', () => {
      expect(result.data.length).toBe(1);
      expect(result.data[0].type).toBe('table');
      expect(result.data[0].columns[0].text).toBe('id');
      expect(result.data[0].columns[1].text).toBe('p75 value');
      expect(result.data[0].columns[2].text).toBe('p90 value');
      expect(result.data[0].rows.length).toBe(2);
      expect(result.data[0].rows[0][0]).toBe('id1');
      expect(result.data[0].rows[0][1]).toBe(3.3);
      expect(result.data[0].rows[0][2]).toBe(5.5);
      expect(result.data[0].rows[1][0]).toBe('id2');
      expect(result.data[0].rows[1][1]).toBe(2.3);
      expect(result.data[0].rows[1][2]).toBe(4.5);
    });
  });

  describe('Multiple metrics of same type', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { type: 'avg', id: '1', field: 'test' },
            { type: 'avg', id: '2', field: 'test2' },
          ],
          bucketAggs: [{ id: '2', type: 'terms', field: 'host' }],
        },
      ];

      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    '1': { value: 1000 },
                    '2': { value: 3000 },
                    key: 'server-1',
                    doc_count: 369,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should include field in metric name', () => {
      expect(result.data[0].type).toBe('table');
      expect(result.data[0].rows[0][1]).toBe(1000);
      expect(result.data[0].rows[0][2]).toBe(3000);
    });
  });

  describe('Raw documents query', () => {
    let result: {
      data: Array<MockedResultData<{ [key: string]: string | undefined }>>;
    };
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'raw_document', id: '1' }],
          bucketAggs: [],
        },
      ];
      response = {
        responses: [
          {
            hits: {
              total: 100,
              hits: [
                {
                  _id: '1',
                  _type: 'type',
                  _index: 'index',
                  _source: { sourceProp: 'asd' },
                  fields: { fieldProp: 'field' },
                },
                {
                  _source: { sourceProp: 'asd2' },
                  fields: { fieldProp: 'field2' },
                },
              ],
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return docs', () => {
      expect(result.data.length).toBe(1);
      expect(result.data[0].type).toBe('docs');
      expect(result.data[0].total).toBe(100);
      expect(result.data[0].datapoints.length).toBe(2);
      expect(result.data[0].datapoints[0].sourceProp).toBe('asd');
      expect(result.data[0].datapoints[0].fieldProp).toBe('field');
    });
  });

  describe('with bucket_script ', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { id: '1', type: 'sum', field: '@value' },
            { id: '3', type: 'max', field: '@value' },
            {
              id: '4',
              pipelineVariables: [
                { name: 'var1', pipelineAgg: '1' },
                { name: 'var2', pipelineAgg: '3' },
              ],
              settings: { script: 'params.var1 * params.var2' },
              type: 'bucket_script',
            },
          ],
          bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    1: { value: 2 },
                    3: { value: 3 },
                    4: { value: 6 },
                    doc_count: 60,
                    key: 1000,
                  },
                  {
                    1: { value: 3 },
                    3: { value: 4 },
                    4: { value: 12 },
                    doc_count: 60,
                    key: 2000,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });
    it('should return 3 series', () => {
      expect(result.data.length).toBe(3);
      expect(result.data[0].datapoints.length).toBe(2);
      expect(result.data[0].target).toBe('Sum @value');
      expect(result.data[1].target).toBe('Max @value');
      expect(result.data[2].target).toBe('Sum @value * Max @value');
      expect(result.data[0].datapoints[0][0]).toBe(2);
      expect(result.data[1].datapoints[0][0]).toBe(3);
      expect(result.data[2].datapoints[0][0]).toBe(6);
      expect(result.data[0].datapoints[1][0]).toBe(3);
      expect(result.data[1].datapoints[1][0]).toBe(4);
      expect(result.data[2].datapoints[1][0]).toBe(12);
    });
  });

  describe('terms with bucket_script and two scripts', () => {
    let result: {
      data: MockedResultData[];
    };

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { id: '1', type: 'sum', field: '@value' },
            { id: '3', type: 'max', field: '@value' },
            {
              id: '4',
              pipelineVariables: [
                { name: 'var1', pipelineAgg: '1' },
                { name: 'var2', pipelineAgg: '3' },
              ],
              settings: { script: 'params.var1 * params.var2' },
              type: 'bucket_script',
            },
            {
              id: '5',
              pipelineVariables: [
                { name: 'var1', pipelineAgg: '1' },
                { name: 'var2', pipelineAgg: '3' },
              ],
              settings: { script: 'params.var1 * params.var2 * 4' },
              type: 'bucket_script',
            },
          ],
          bucketAggs: [{ type: 'terms', field: '@timestamp', id: '2' }],
        },
      ];
      response = {
        responses: [
          {
            aggregations: {
              '2': {
                buckets: [
                  {
                    1: { value: 2 },
                    3: { value: 3 },
                    4: { value: 6 },
                    5: { value: 24 },
                    doc_count: 60,
                    key: 1000,
                  },
                  {
                    1: { value: 3 },
                    3: { value: 4 },
                    4: { value: 12 },
                    5: { value: 48 },
                    doc_count: 60,
                    key: 2000,
                  },
                ],
              },
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should return 2 rows with 5 columns', () => {
      expect(result.data[0].columns.length).toBe(5);
      expect(result.data[0].rows.length).toBe(2);
      expect(result.data[0].rows[0][1]).toBe(2);
      expect(result.data[0].rows[0][2]).toBe(3);
      expect(result.data[0].rows[0][3]).toBe(6);
      expect(result.data[0].rows[0][4]).toBe(24);
      expect(result.data[0].rows[1][1]).toBe(3);
      expect(result.data[0].rows[1][2]).toBe(4);
      expect(result.data[0].rows[1][3]).toBe(12);
      expect(result.data[0].rows[1][4]).toBe(48);
    });
  });

  describe('Raw Data Query', () => {
    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'raw_data', id: '1' }],
          bucketAggs: [],
        },
      ];

      response = {
        responses: [
          {
            hits: {
              total: {
                relation: 'eq',
                value: 1,
              },
              hits: [
                {
                  _id: '1',
                  _type: '_doc',
                  _index: 'index',
                  _source: { sourceProp: 'asd' },
                },
              ],
            },
          },
        ],
      };

      result = new ElasticResponse(targets, response).getTimeSeries();
    });

    it('should create dataframes with filterable fields', () => {
      for (const field of result.data[0].fields) {
        expect(field.config.filterable).toBe(true);
      }
    });
  });

  describe('simple logs query and count', () => {
    const targets: ElasticsearchQuery[] = [
      {
        refId: 'A',
        metrics: [{ type: 'count', id: '1' }],
        bucketAggs: [{ type: 'date_histogram', settings: { interval: 'auto' }, id: '2' }],
        key: 'Q-1561369883389-0.7611823271062786-0',
        query: 'hello AND message',
        timeField: '@timestamp',
      },
    ];
    const response = {
      responses: [
        {
          aggregations: {
            '2': {
              buckets: [
                {
                  doc_count: 10,
                  key: 1000,
                },
                {
                  doc_count: 15,
                  key: 2000,
                },
              ],
            },
          },
          hits: {
            hits: [
              {
                _id: 'fdsfs',
                _type: '_doc',
                _index: 'mock-index',
                _source: {
                  '@timestamp': '2019-06-24T09:51:19.765Z',
                  host: 'djisaodjsoad',
                  number: 1,
                  message: 'hello, i am a message',
                  level: 'debug',
                  fields: {
                    lvl: 'debug',
                  },
                },
                highlight: {
                  message: [
                    `${highlightTags.pre}hello${highlightTags.post}, i am a ${highlightTags.pre}message${highlightTags.post}`,
                  ],
                },
              },
              {
                _id: 'kdospaidopa',
                _type: '_doc',
                _index: 'mock-index',
                _source: {
                  '@timestamp': '2019-06-24T09:52:19.765Z',
                  host: 'dsalkdakdop',
                  number: 2,
                  message: 'hello, i am also message',
                  level: 'error',
                  fields: {
                    lvl: 'info',
                  },
                },
                highlight: {
                  message: [
                    `${highlightTags.pre}hello${highlightTags.post}, i am a ${highlightTags.pre}message${highlightTags.post}`,
                  ],
                },
              },
            ],
          },
        },
      ],
    };

    it('should return histogram aggregation and documents', () => {
      const result = new ElasticResponse(targets, response).getLogs();
      expect(result.data.length).toBe(2);
      const logResults = result.data[0] as MutableDataFrame;
      expect(logResults).toHaveProperty('meta');
      expect(logResults.meta).toEqual({
        searchWords: ['hello', 'message'],
        preferredVisualisationType: 'logs',
      });

      const fields = logResults.fields.map((f) => {
        return {
          name: f.name,
          type: f.type,
        };
      });

      expect(fields).toContainEqual({ name: '@timestamp', type: 'time' });
      expect(fields).toContainEqual({ name: 'host', type: 'string' });
      expect(fields).toContainEqual({ name: 'message', type: 'string' });

      let rows = new DataFrameView(logResults);
      for (let i = 0; i < rows.length; i++) {
        const r = rows.get(i);
        expect(r._id).toEqual(response.responses[0].hits.hits[i]._id);
        expect(r._type).toEqual(response.responses[0].hits.hits[i]._type);
        expect(r._index).toEqual(response.responses[0].hits.hits[i]._index);
        expect(r._source).toEqual(flatten(response.responses[0].hits.hits[i]._source));
      }

      // Make a map from the histogram results
      const hist: KeyValue<number> = {};
      const histogramResults = new MutableDataFrame(result.data[1]);
      rows = new DataFrameView(histogramResults);

      for (let i = 0; i < rows.length; i++) {
        const row = rows.get(i);
        hist[row.Time] = row.Value;
      }

      response.responses[0].aggregations['2'].buckets.forEach((bucket) => {
        expect(hist[bucket.key]).toEqual(bucket.doc_count);
      });
    });

    it('should map levels field', () => {
      const result = new ElasticResponse(targets, response).getLogs(undefined, 'level');
      const fieldCache = new FieldCache(result.data[0]);
      const field = fieldCache.getFieldByName('level');
      expect(field?.values.toArray()).toEqual(['debug', 'error']);
    });

    it('should re map levels field to new field', () => {
      const result = new ElasticResponse(targets, response).getLogs(undefined, 'fields.lvl');
      const fieldCache = new FieldCache(result.data[0]);
      const field = fieldCache.getFieldByName('level');
      expect(field?.values.toArray()).toEqual(['debug', 'info']);
    });

    it('should correctly guess field types', () => {
      const result = new ElasticResponse(targets, response).getLogs();
      const logResults = result.data[0] as MutableDataFrame;

      const fields = logResults.fields.map((f) => {
        return {
          name: f.name,
          type: f.type,
        };
      });

      expect(fields).toContainEqual({ name: '@timestamp', type: 'time' });
      expect(fields).toContainEqual({ name: 'number', type: 'number' });
      expect(fields).toContainEqual({ name: 'message', type: 'string' });
    });
  });

  describe('logs query with empty response', () => {
    const targets: ElasticsearchQuery[] = [
      {
        refId: 'A',
        metrics: [{ type: 'logs', id: '2' }],
        bucketAggs: [{ type: 'date_histogram', settings: { interval: 'auto' }, id: '1' }],
        key: 'Q-1561369883389-0.7611823271062786-0',
        query: 'hello AND message',
        timeField: '@timestamp',
      },
    ];
    const response = {
      responses: [
        {
          hits: { hits: [] },
          aggregations: {
            '1': {
              buckets: [
                { key_as_string: '1633676760000', key: 1633676760000, doc_count: 0 },
                { key_as_string: '1633676770000', key: 1633676770000, doc_count: 0 },
                { key_as_string: '1633676780000', key: 1633676780000, doc_count: 0 },
              ],
            },
          },
          status: 200,
        },
      ],
    };

    it('should return histogram aggregation and documents', () => {
      const result = new ElasticResponse(targets, response).getLogs('message', 'level');
      expect(result.data.length).toBe(2);
    });
  });
});

interface MockedElasticResponse {
  aggregations?: {
    [key: string]: {
      buckets: Array<{
        doc_count?: number;
        key: string | number;
        [key: string]: unknown;
      }>;
    };
  };
  hits?: {
    total: number;
    hits: Array<{
      _id?: string;
      _type?: string;
      _index?: string;
      _source: { sourceProp: string };
      fields: { fieldProp: string };
    }>;
  };
}

interface MockedQueryData {
  target: ElasticsearchQuery;
  response: MockedElasticResponse;
}

interface MockedResultData<T = number[]> {
  refId: string;
  target: string;
  datapoints: T[];
  type: string;
  rows: number[][];
  total: number;
  fields: Field[];
  columns: Column[];
}

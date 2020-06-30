import { DataFrameView, FieldCache, KeyValue, MutableDataFrame } from '@grafana/data';
import { ElasticResponse } from '../elastic_response';
import flatten from 'app/core/utils/flatten';

describe('ElasticResponse', () => {
  let targets;
  let response: any;
  let result: any;

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
    let result: any;

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
    let result: any;

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
    let result: any;

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
    let result: any;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'percentiles', settings: { percents: [75, 90] }, id: '1' }],
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
      expect(result.data[0].target).toBe('p75');
      expect(result.data[1].target).toBe('p90');
      expect(result.data[0].datapoints[0][0]).toBe(3.3);
      expect(result.data[0].datapoints[0][1]).toBe(1000);
      expect(result.data[1].datapoints[1][0]).toBe(4.5);
    });
  });

  describe('with extended_stats', () => {
    let result: any;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            {
              type: 'extended_stats',
              meta: { max: true, std_deviation_bounds_upper: true },
              id: '1',
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
      expect(result.data[0].target).toBe('server1 Max');
      expect(result.data[1].target).toBe('server1 Std Dev Upper');

      expect(result.data[0].datapoints[0][0]).toBe(10.2);
      expect(result.data[1].datapoints[0][0]).toBe(3);
    });
  });

  describe('single group by with alias pattern', () => {
    let result: any;

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
    let result: any;

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
    let result: any;

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
                filters: [{ query: '@metric:cpu' }, { query: '@metric:logins.count' }],
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
          metrics: [{ type: 'avg', id: '1' }, { type: 'count' }],
          bucketAggs: [
            {
              id: '2',
              type: 'date_histogram',
              field: 'host',
              settings: { trimEdges: 1 },
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
          metrics: [{ type: 'avg', id: '1' }, { type: 'count' }],
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
    let result: any;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [{ type: 'percentiles', field: 'value', settings: { percents: [75, 90] }, id: '1' }],
          bucketAggs: [{ type: 'term', field: 'id', id: '3' }],
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
    let result: any;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { id: '1', type: 'sum', field: '@value' },
            { id: '3', type: 'max', field: '@value' },
            {
              id: '4',
              field: 'select field',
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
    let result: any;

    beforeEach(() => {
      targets = [
        {
          refId: 'A',
          metrics: [
            { id: '1', type: 'sum', field: '@value' },
            { id: '3', type: 'max', field: '@value' },
            {
              id: '4',
              field: 'select field',
              pipelineVariables: [
                { name: 'var1', pipelineAgg: '1' },
                { name: 'var2', pipelineAgg: '3' },
              ],
              settings: { script: 'params.var1 * params.var2' },
              type: 'bucket_script',
            },
            {
              id: '5',
              field: 'select field',
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

  describe('simple logs query and count', () => {
    const targets: any = [
      {
        refId: 'A',
        metrics: [{ type: 'count', id: '1' }],
        bucketAggs: [{ type: 'date_histogram', settings: { interval: 'auto' }, id: '2' }],
        context: 'explore',
        interval: '10s',
        isLogsQuery: true,
        key: 'Q-1561369883389-0.7611823271062786-0',
        liveStreaming: false,
        maxDataPoints: 1620,
        query: '',
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
                  message: 'hello, i am a message',
                  level: 'debug',
                  fields: {
                    lvl: 'debug',
                  },
                },
              },
              {
                _id: 'kdospaidopa',
                _type: '_doc',
                _index: 'mock-index',
                _source: {
                  '@timestamp': '2019-06-24T09:52:19.765Z',
                  host: 'dsalkdakdop',
                  message: 'hello, i am also message',
                  level: 'error',
                  fields: {
                    lvl: 'info',
                  },
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
      const fields = logResults.fields.map(f => {
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
        expect(r._source).toEqual(
          flatten(
            response.responses[0].hits.hits[i]._source,
            (null as unknown) as { delimiter?: any; maxDepth?: any; safe?: any }
          )
        );
      }

      // Make a map from the histogram results
      const hist: KeyValue<number> = {};
      const histogramResults = new MutableDataFrame(result.data[1]);
      rows = new DataFrameView(histogramResults);

      for (let i = 0; i < rows.length; i++) {
        const row = rows.get(i);
        hist[row.Time] = row.Value;
      }

      response.responses[0].aggregations['2'].buckets.forEach((bucket: any) => {
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
  });
});

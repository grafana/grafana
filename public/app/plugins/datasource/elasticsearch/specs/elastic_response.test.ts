import { DataFrameView, FieldCache, KeyValue, MutableDataFrame, ArrayVector } from '@grafana/data';
import { ElasticResponse } from '../elastic_response';
import flatten from 'app/core/utils/flatten';

describe('ElasticResponse', () => {
  let targets;
  let response: any;
  let result: any;

  describe('simple query and count', () => {
    it('should return 1 series', () => {
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
      expect(result.data.length).toBe(1);
      expect(result.data).toEqual([
        {
          name: 'Count',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([10, 15]),
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  describe('simple query count & avg aggregation', () => {
    it('should return 2 series', () => {
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
      expect(result.data.length).toBe(2);

      expect(result.data).toEqual([
        {
          name: 'Count',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([10, 15]),
            },
          ],
          length: 2,
        },
        {
          name: 'Average value',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([88, 99]),
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  describe('single group by query one metric', () => {
    it('should return 2 series', () => {
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
      expect(result.data.length).toBe(2);

      expect(result.data).toEqual([
        {
          name: 'server1',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([1, 3]),
            },
          ],
          length: 2,
        },
        {
          name: 'server2',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([2, 8]),
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  describe('single group by query two metrics', () => {
    it('should return 2 series', () => {
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
      expect(result.data.length).toBe(4);

      expect(result.data).toEqual([
        {
          name: 'server1 Count',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([1, 3]),
            },
          ],
          length: 2,
        },
        {
          name: 'server1 Average @value',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([10, 12]),
            },
          ],
          length: 2,
        },
        {
          name: 'server2 Count',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([1, 3]),
            },
          ],
          length: 2,
        },
        {
          name: 'server2 Average @value',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([20, 32]),
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  describe('with percentiles ', () => {
    it('should return 2 series', () => {
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
      expect(result.data.length).toBe(2);

      expect(result.data).toEqual([
        {
          name: 'p75',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([3.3, 2.3]),
            },
          ],
          length: 2,
        },
        {
          name: 'p90',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([5.5, 4.5]),
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  describe('with extended_stats', () => {
    it('should return 4 series', () => {
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
      expect(result.data.length).toBe(4);

      expect(result.data).toEqual([
        {
          name: 'server1 Max',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([10.2]),
            },
          ],
          length: 1,
        },
        {
          name: 'server1 Std Dev Upper',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([3]),
            },
          ],
          length: 1,
        },
        {
          name: 'server2 Max',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([10.2]),
            },
          ],
          length: 1,
        },
        {
          name: 'server2 Std Dev Upper',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([3]),
            },
          ],
          length: 1,
        },
      ]);
    });
  });

  describe('single group by with alias pattern', () => {
    it('should return 2 series', () => {
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
      expect(result.data.length).toBe(3);

      expect(result.data).toEqual([
        {
          name: 'server1 Count and {{not_exist}} server1',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([1, 3]),
            },
          ],
          length: 2,
        },
        {
          name: 'server2 Count and {{not_exist}} server2',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([2, 8]),
            },
          ],
          length: 2,
        },
        {
          name: '0 Count and {{not_exist}} 0',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([2, 8]),
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  describe('histogram response', () => {
    it('should return table with byte and count', () => {
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
      expect(result.data.length).toBe(1);

      expect(result.data).toEqual([
        {
          name: undefined,
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {
                filterable: true,
              },
              name: 'bytes',
              type: 'number',
              values: new ArrayVector([1000, 2000, 1000]),
            },
            {
              config: {},
              labels: undefined,
              name: 'Count',
              type: 'number',
              values: new ArrayVector([1, 3, 2]),
            },
          ],
          length: 3,
        },
      ]);
    });
  });

  describe('with two filters agg', () => {
    it('should return 2 series', () => {
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
      expect(result.data.length).toBe(2);

      expect(result.data).toEqual([
        {
          name: '@metric:cpu',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([1, 3]),
            },
          ],
          length: 2,
        },
        {
          name: '@metric:logins.count',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([2, 8]),
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  describe('with dropfirst and last aggregation', () => {
    it('should remove first and last value', () => {
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
      expect(result.data.length).toBe(2);

      expect(result.data).toEqual([
        {
          name: 'Average',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([2]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([2000]),
            },
          ],
          length: 1,
        },
        {
          name: 'Count',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([2]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([200]),
            },
          ],
          length: 1,
        },
      ]);
    });
  });

  describe('No group by time', () => {
    it('should return table', () => {
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
      expect(result.data.length).toBe(1);

      expect(result.data).toEqual([
        {
          name: undefined,
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {
                filterable: true,
              },
              name: 'host',
              type: 'string',
              values: new ArrayVector(['server-1', 'server-2']),
            },
            {
              config: {},
              labels: undefined,
              name: 'Average',
              type: 'number',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {},
              labels: undefined,
              name: 'Count',
              type: 'number',
              values: new ArrayVector([369, 200]),
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  describe('No group by time with percentiles ', () => {
    it('should return table', () => {
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
      expect(result.data.length).toBe(1);

      expect(result.data).toEqual([
        {
          name: undefined,
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {
                filterable: true,
              },
              name: 'id',
              type: 'string',
              values: new ArrayVector(['id1', 'id2']),
            },
            {
              config: {},
              labels: undefined,
              name: 'p75 value',
              type: 'number',
              values: new ArrayVector([3.3, 2.3]),
            },
            {
              config: {},
              labels: undefined,
              name: 'p90 value',
              type: 'number',
              values: new ArrayVector([5.5, 4.5]),
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  describe('Multiple metrics of same type', () => {
    it('should include field in metric name', () => {
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
      expect(result.data.length).toBe(1);

      expect(result.data).toEqual([
        {
          name: undefined,
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {
                filterable: true,
              },
              name: 'host',
              type: 'string',
              values: new ArrayVector(['server-1']),
            },
            {
              config: {},
              labels: undefined,
              name: 'Average test',
              type: 'number',
              values: new ArrayVector([1000]),
            },
            {
              config: {},
              labels: undefined,
              name: 'Average test2',
              type: 'number',
              values: new ArrayVector([3000]),
            },
          ],
          length: 1,
        },
      ]);
    });
  });

  describe('Raw documents query', () => {
    it('should return docs', () => {
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
      expect(result.data.length).toBe(1);
      const firstSeriesRows = new DataFrameView(result.data[0]);
      const expectedValues: any[] = [
        {
          Time: null,
          _id: '1',
          _index: 'index',
          _source: { sourceProp: 'asd' },
          _type: 'type',
          sourceProp: 'asd',
        },
        {
          Time: null,
          _id: null,
          _index: null,
          _source: { sourceProp: 'asd2' },
          _type: null,
          sourceProp: 'asd2',
        },
      ];

      for (let i = 0; i < firstSeriesRows.length; i++) {
        const row = firstSeriesRows.get(i);
        expect(row.Time).toEqual(expectedValues[i].Time);
        expect(row._source).toEqual(expectedValues[i]._source);
        expect(row._id).toEqual(expectedValues[i]._id);
        expect(row._index).toEqual(expectedValues[i]._index);
        expect(row._type).toEqual(expectedValues[i]._type);
        expect(row.sourceProp).toEqual(expectedValues[i].sourceProp);
      }
    });
  });

  describe('with bucket_script ', () => {
    it('should return 3 series', () => {
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
      expect(result.data.length).toBe(3);

      expect(result.data).toEqual([
        {
          name: 'Sum @value',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([2, 3]),
            },
          ],
          length: 2,
        },
        {
          name: 'Max @value',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([3, 4]),
            },
          ],
          length: 2,
        },
        {
          name: 'Sum @value * Max @value',
          refId: undefined,
          meta: undefined,
          fields: [
            {
              config: {},
              name: 'Time',
              type: 'time',
              values: new ArrayVector([1000, 2000]),
            },
            {
              config: {
                unit: undefined,
              },
              labels: undefined,
              name: 'Value',
              type: 'number',
              values: new ArrayVector([6, 12]),
            },
          ],
          length: 2,
        },
      ]);
    });
  });

  describe('simple logs query and count', () => {
    const targets = [
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

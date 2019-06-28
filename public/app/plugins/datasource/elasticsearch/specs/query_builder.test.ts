import { ElasticQueryBuilder } from '../query_builder';

describe('ElasticQueryBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new ElasticQueryBuilder({ timeField: '@timestamp' });
  });

  it('with defaults', () => {
    const query = builder.build({
      metrics: [{ type: 'Count', id: '0' }],
      timeField: '@timestamp',
      bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
    });

    expect(query.query.bool.filter[0].range['@timestamp'].gte).toBe('$timeFrom');
    expect(query.aggs['1'].date_histogram.extended_bounds.min).toBe('$timeFrom');
  });

  it('with defaults on es5.x', () => {
    const builder5x = new ElasticQueryBuilder({
      timeField: '@timestamp',
      esVersion: 5,
    });

    const query = builder5x.build({
      metrics: [{ type: 'Count', id: '0' }],
      timeField: '@timestamp',
      bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
    });

    expect(query.query.bool.filter[0].range['@timestamp'].gte).toBe('$timeFrom');
    expect(query.aggs['1'].date_histogram.extended_bounds.min).toBe('$timeFrom');
  });

  it('with multiple bucket aggs', () => {
    const query = builder.build({
      metrics: [{ type: 'count', id: '1' }],
      timeField: '@timestamp',
      bucketAggs: [
        { type: 'terms', field: '@host', id: '2' },
        { type: 'date_histogram', field: '@timestamp', id: '3' },
      ],
    });

    expect(query.aggs['2'].terms.field).toBe('@host');
    expect(query.aggs['2'].aggs['3'].date_histogram.field).toBe('@timestamp');
  });

  it('with select field', () => {
    const query = builder.build(
      {
        metrics: [{ type: 'avg', field: '@value', id: '1' }],
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
      },
      100,
      1000
    );

    const aggs = query.aggs['2'].aggs;
    expect(aggs['1'].avg.field).toBe('@value');
  });

  it('with term agg and order by term', () => {
    const query = builder.build(
      {
        metrics: [{ type: 'count', id: '1' }, { type: 'avg', field: '@value', id: '5' }],
        bucketAggs: [
          {
            type: 'terms',
            field: '@host',
            settings: { size: 5, order: 'asc', orderBy: '_term' },
            id: '2',
          },
          { type: 'date_histogram', field: '@timestamp', id: '3' },
        ],
      },
      100,
      1000
    );

    const firstLevel = query.aggs['2'];
    expect(firstLevel.terms.order._term).toBe('asc');
  });

  it('with term agg and order by term on es6.x', () => {
    const builder6x = new ElasticQueryBuilder({
      timeField: '@timestamp',
      esVersion: 60,
    });
    const query = builder6x.build(
      {
        metrics: [{ type: 'count', id: '1' }, { type: 'avg', field: '@value', id: '5' }],
        bucketAggs: [
          {
            type: 'terms',
            field: '@host',
            settings: { size: 5, order: 'asc', orderBy: '_term' },
            id: '2',
          },
          { type: 'date_histogram', field: '@timestamp', id: '3' },
        ],
      },
      100,
      1000
    );

    const firstLevel = query.aggs['2'];
    expect(firstLevel.terms.order._key).toBe('asc');
  });

  it('with term agg and order by metric agg', () => {
    const query = builder.build(
      {
        metrics: [{ type: 'count', id: '1' }, { type: 'avg', field: '@value', id: '5' }],
        bucketAggs: [
          {
            type: 'terms',
            field: '@host',
            settings: { size: 5, order: 'asc', orderBy: '5' },
            id: '2',
          },
          { type: 'date_histogram', field: '@timestamp', id: '3' },
        ],
      },
      100,
      1000
    );

    const firstLevel = query.aggs['2'];
    const secondLevel = firstLevel.aggs['3'];

    expect(firstLevel.aggs['5'].avg.field).toBe('@value');
    expect(secondLevel.aggs['5'].avg.field).toBe('@value');
  });

  it('with metric percentiles', () => {
    const query = builder.build(
      {
        metrics: [
          {
            id: '1',
            type: 'percentiles',
            field: '@load_time',
            settings: {
              percents: [1, 2, 3, 4],
            },
          },
        ],
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
      },
      100,
      1000
    );

    const firstLevel = query.aggs['3'];

    expect(firstLevel.aggs['1'].percentiles.field).toBe('@load_time');
    expect(firstLevel.aggs['1'].percentiles.percents).toEqual([1, 2, 3, 4]);
  });

  it('with filters aggs', () => {
    const query = builder.build({
      metrics: [{ type: 'count', id: '1' }],
      timeField: '@timestamp',
      bucketAggs: [
        {
          id: '2',
          type: 'filters',
          settings: {
            filters: [{ query: '@metric:cpu' }, { query: '@metric:logins.count' }],
          },
        },
        { type: 'date_histogram', field: '@timestamp', id: '4' },
      ],
    });

    expect(query.aggs['2'].filters.filters['@metric:cpu'].query_string.query).toBe('@metric:cpu');
    expect(query.aggs['2'].filters.filters['@metric:logins.count'].query_string.query).toBe('@metric:logins.count');
    expect(query.aggs['2'].aggs['4'].date_histogram.field).toBe('@timestamp');
  });

  it('with filters aggs on es5.x', () => {
    const builder5x = new ElasticQueryBuilder({
      timeField: '@timestamp',
      esVersion: 5,
    });
    const query = builder5x.build({
      metrics: [{ type: 'count', id: '1' }],
      timeField: '@timestamp',
      bucketAggs: [
        {
          id: '2',
          type: 'filters',
          settings: {
            filters: [{ query: '@metric:cpu' }, { query: '@metric:logins.count' }],
          },
        },
        { type: 'date_histogram', field: '@timestamp', id: '4' },
      ],
    });

    expect(query.aggs['2'].filters.filters['@metric:cpu'].query_string.query).toBe('@metric:cpu');
    expect(query.aggs['2'].filters.filters['@metric:logins.count'].query_string.query).toBe('@metric:logins.count');
    expect(query.aggs['2'].aggs['4'].date_histogram.field).toBe('@timestamp');
  });

  it('with raw_document metric', () => {
    const query = builder.build({
      metrics: [{ type: 'raw_document', id: '1', settings: {} }],
      timeField: '@timestamp',
      bucketAggs: [],
    });

    expect(query.size).toBe(500);
  });
  it('with raw_document metric size set', () => {
    const query = builder.build({
      metrics: [{ type: 'raw_document', id: '1', settings: { size: 1337 } }],
      timeField: '@timestamp',
      bucketAggs: [],
    });

    expect(query.size).toBe(1337);
  });

  it('with moving average', () => {
    const query = builder.build({
      metrics: [
        {
          id: '3',
          type: 'sum',
          field: '@value',
        },
        {
          id: '2',
          type: 'moving_avg',
          field: '3',
          pipelineAgg: '3',
        },
      ],
      bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
    });

    const firstLevel = query.aggs['3'];

    expect(firstLevel.aggs['2']).not.toBe(undefined);
    expect(firstLevel.aggs['2'].moving_avg).not.toBe(undefined);
    expect(firstLevel.aggs['2'].moving_avg.buckets_path).toBe('3');
  });

  it('with moving average doc count', () => {
    const query = builder.build({
      metrics: [
        {
          id: '3',
          type: 'count',
          field: 'select field',
        },
        {
          id: '2',
          type: 'moving_avg',
          field: '3',
          pipelineAgg: '3',
        },
      ],
      bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '4' }],
    });

    const firstLevel = query.aggs['4'];

    expect(firstLevel.aggs['2']).not.toBe(undefined);
    expect(firstLevel.aggs['2'].moving_avg).not.toBe(undefined);
    expect(firstLevel.aggs['2'].moving_avg.buckets_path).toBe('_count');
  });

  it('with broken moving average', () => {
    const query = builder.build({
      metrics: [
        {
          id: '3',
          type: 'sum',
          field: '@value',
        },
        {
          id: '2',
          type: 'moving_avg',
          pipelineAgg: '3',
        },
        {
          id: '4',
          type: 'moving_avg',
          pipelineAgg: 'Metric to apply moving average',
        },
      ],
      bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
    });

    const firstLevel = query.aggs['3'];

    expect(firstLevel.aggs['2']).not.toBe(undefined);
    expect(firstLevel.aggs['2'].moving_avg).not.toBe(undefined);
    expect(firstLevel.aggs['2'].moving_avg.buckets_path).toBe('3');
    expect(firstLevel.aggs['4']).toBe(undefined);
  });

  it('with derivative', () => {
    const query = builder.build({
      metrics: [
        {
          id: '3',
          type: 'sum',
          field: '@value',
        },
        {
          id: '2',
          type: 'derivative',
          pipelineAgg: '3',
        },
      ],
      bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
    });

    const firstLevel = query.aggs['3'];

    expect(firstLevel.aggs['2']).not.toBe(undefined);
    expect(firstLevel.aggs['2'].derivative).not.toBe(undefined);
    expect(firstLevel.aggs['2'].derivative.buckets_path).toBe('3');
  });

  it('with derivative doc count', () => {
    const query = builder.build({
      metrics: [
        {
          id: '3',
          type: 'count',
          field: 'select field',
        },
        {
          id: '2',
          type: 'derivative',
          pipelineAgg: '3',
        },
      ],
      bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '4' }],
    });

    const firstLevel = query.aggs['4'];

    expect(firstLevel.aggs['2']).not.toBe(undefined);
    expect(firstLevel.aggs['2'].derivative).not.toBe(undefined);
    expect(firstLevel.aggs['2'].derivative.buckets_path).toBe('_count');
  });

  it('with bucket_script', () => {
    const query = builder.build({
      metrics: [
        {
          id: '1',
          type: 'sum',
          field: '@value',
        },
        {
          id: '3',
          type: 'max',
          field: '@value',
        },
        {
          field: 'select field',
          id: '4',
          meta: {},
          pipelineVariables: [
            {
              name: 'var1',
              pipelineAgg: '1',
            },
            {
              name: 'var2',
              pipelineAgg: '3',
            },
          ],
          settings: {
            script: 'params.var1 * params.var2',
          },
          type: 'bucket_script',
        },
      ],
      bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
    });

    const firstLevel = query.aggs['2'];

    expect(firstLevel.aggs['4']).not.toBe(undefined);
    expect(firstLevel.aggs['4'].bucket_script).not.toBe(undefined);
    expect(firstLevel.aggs['4'].bucket_script.buckets_path).toMatchObject({ var1: '1', var2: '3' });
  });

  it('with bucket_script doc count', () => {
    const query = builder.build({
      metrics: [
        {
          id: '3',
          type: 'count',
          field: 'select field',
        },
        {
          field: 'select field',
          id: '4',
          meta: {},
          pipelineVariables: [
            {
              name: 'var1',
              pipelineAgg: '3',
            },
          ],
          settings: {
            script: 'params.var1 * 1000',
          },
          type: 'bucket_script',
        },
      ],
      bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
    });

    const firstLevel = query.aggs['2'];

    expect(firstLevel.aggs['4']).not.toBe(undefined);
    expect(firstLevel.aggs['4'].bucket_script).not.toBe(undefined);
    expect(firstLevel.aggs['4'].bucket_script.buckets_path).toMatchObject({ var1: '_count' });
  });

  it('with histogram', () => {
    const query = builder.build({
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [
        {
          type: 'histogram',
          field: 'bytes',
          id: '3',
          settings: { interval: 10, min_doc_count: 2, missing: 5 },
        },
      ],
    });

    const firstLevel = query.aggs['3'];
    expect(firstLevel.histogram.field).toBe('bytes');
    expect(firstLevel.histogram.interval).toBe(10);
    expect(firstLevel.histogram.min_doc_count).toBe(2);
    expect(firstLevel.histogram.missing).toBe(5);
  });

  it('with adhoc filters', () => {
    const query = builder.build(
      {
        metrics: [{ type: 'Count', id: '0' }],
        timeField: '@timestamp',
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
      },
      [
        { key: 'key1', operator: '=', value: 'value1' },
        { key: 'key2', operator: '=', value: 'value2' },
        { key: 'key2', operator: '!=', value: 'value2' },
        { key: 'key3', operator: '<', value: 'value3' },
        { key: 'key4', operator: '>', value: 'value4' },
        { key: 'key5', operator: '=~', value: 'value5' },
        { key: 'key6', operator: '!~', value: 'value6' },
      ]
    );

    expect(query.query.bool.must[0].match_phrase['key1'].query).toBe('value1');
    expect(query.query.bool.must[1].match_phrase['key2'].query).toBe('value2');
    expect(query.query.bool.must_not[0].match_phrase['key2'].query).toBe('value2');
    expect(query.query.bool.filter[2].range['key3'].lt).toBe('value3');
    expect(query.query.bool.filter[3].range['key4'].gt).toBe('value4');
    expect(query.query.bool.filter[4].regexp['key5']).toBe('value5');
    expect(query.query.bool.filter[5].bool.must_not.regexp['key6']).toBe('value6');
  });

  it('getTermsQuery should set correct sorting', () => {
    const query = builder.getTermsQuery({});
    expect(query.aggs['1'].terms.order._term).toBe('asc');
  });

  it('getTermsQuery es6.x should set correct sorting', () => {
    const builder6x = new ElasticQueryBuilder({
      timeField: '@timestamp',
      esVersion: 60,
    });
    const query = builder6x.getTermsQuery({});
    expect(query.aggs['1'].terms.order._key).toBe('asc');
  });

  it('getTermsQuery should request documents and date histogram', () => {
    const query = builder.getLogsQuery({});
    expect(query).toHaveProperty('query.bool.filter');
    expect(query.aggs['2']).toHaveProperty('date_histogram');
  });
});

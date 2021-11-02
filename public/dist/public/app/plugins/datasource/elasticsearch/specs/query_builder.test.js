import { gte, lt } from 'semver';
import { ElasticQueryBuilder } from '../query_builder';
describe('ElasticQueryBuilder', function () {
    var builder = new ElasticQueryBuilder({ timeField: '@timestamp', esVersion: '2.0.0' });
    var builder5x = new ElasticQueryBuilder({ timeField: '@timestamp', esVersion: '5.0.0' });
    var builder56 = new ElasticQueryBuilder({ timeField: '@timestamp', esVersion: '5.6.0' });
    var builder6x = new ElasticQueryBuilder({ timeField: '@timestamp', esVersion: '6.0.0' });
    var builder7x = new ElasticQueryBuilder({ timeField: '@timestamp', esVersion: '7.0.0' });
    var builder77 = new ElasticQueryBuilder({ timeField: '@timestamp', esVersion: '7.7.0' });
    var allBuilders = [builder, builder5x, builder56, builder6x, builder7x, builder77];
    allBuilders.forEach(function (builder) {
        describe("version " + builder.esVersion, function () {
            it('should return query with defaults', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [{ type: 'count', id: '0' }],
                    timeField: '@timestamp',
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
                });
                expect(query.query.bool.filter[0].range['@timestamp'].gte).toBe('$timeFrom');
                expect(query.aggs['1'].date_histogram.extended_bounds.min).toBe('$timeFrom');
            });
            it('should clean settings from null values', function () {
                var query = builder.build({
                    refId: 'A',
                    // The following `missing: null as any` is because previous versions of the DS where
                    // storing null in the query model when inputting an empty string,
                    // which were then removed in the query builder.
                    // The new version doesn't store empty strings at all. This tests ensures backward compatinility.
                    metrics: [{ type: 'avg', id: '0', settings: { missing: null, script: '1' } }],
                    timeField: '@timestamp',
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
                });
                expect(query.aggs['1'].aggs['0'].avg.missing).not.toBeDefined();
                expect(query.aggs['1'].aggs['0'].avg.script).toBeDefined();
            });
            it('with multiple bucket aggs', function () {
                var query = builder.build({
                    refId: 'A',
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
            it('with select field', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [{ type: 'avg', field: '@value', id: '1' }],
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
                }, 100, '1000');
                var aggs = query.aggs['2'].aggs;
                expect(aggs['1'].avg.field).toBe('@value');
            });
            it('term agg and order by term', function () {
                var target = {
                    refId: 'A',
                    metrics: [
                        { type: 'count', id: '1' },
                        { type: 'avg', field: '@value', id: '5' },
                    ],
                    bucketAggs: [
                        {
                            type: 'terms',
                            field: '@host',
                            settings: { size: '5', order: 'asc', orderBy: '_term' },
                            id: '2',
                        },
                        { type: 'date_histogram', field: '@timestamp', id: '3' },
                    ],
                };
                var query = builder.build(target, 100, '1000');
                var firstLevel = query.aggs['2'];
                if (gte(builder.esVersion, '6.0.0')) {
                    expect(firstLevel.terms.order._key).toBe('asc');
                }
                else {
                    expect(firstLevel.terms.order._term).toBe('asc');
                }
            });
            it('with term agg and order by metric agg', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [
                        { type: 'count', id: '1' },
                        { type: 'avg', field: '@value', id: '5' },
                    ],
                    bucketAggs: [
                        {
                            type: 'terms',
                            field: '@host',
                            settings: { size: '5', order: 'asc', orderBy: '5' },
                            id: '2',
                        },
                        { type: 'date_histogram', field: '@timestamp', id: '3' },
                    ],
                }, 100, '1000');
                var firstLevel = query.aggs['2'];
                var secondLevel = firstLevel.aggs['3'];
                expect(firstLevel.aggs['5'].avg.field).toBe('@value');
                expect(secondLevel.aggs['5'].avg.field).toBe('@value');
            });
            it('with term agg and order by count agg', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [
                        { type: 'count', id: '1' },
                        { type: 'avg', field: '@value', id: '5' },
                    ],
                    bucketAggs: [
                        {
                            type: 'terms',
                            field: '@host',
                            settings: { size: '5', order: 'asc', orderBy: '1' },
                            id: '2',
                        },
                        { type: 'date_histogram', field: '@timestamp', id: '3' },
                    ],
                }, 100, '1000');
                expect(query.aggs['2'].terms.order._count).toEqual('asc');
                expect(query.aggs['2'].aggs).not.toHaveProperty('1');
            });
            it('with term agg and order by extended_stats agg', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [{ type: 'extended_stats', id: '1', field: '@value', meta: { std_deviation: true } }],
                    bucketAggs: [
                        {
                            type: 'terms',
                            field: '@host',
                            settings: { size: '5', order: 'asc', orderBy: '1[std_deviation]' },
                            id: '2',
                        },
                        { type: 'date_histogram', field: '@timestamp', id: '3' },
                    ],
                }, 100, '1000');
                var firstLevel = query.aggs['2'];
                var secondLevel = firstLevel.aggs['3'];
                expect(firstLevel.aggs['1'].extended_stats.field).toBe('@value');
                expect(secondLevel.aggs['1'].extended_stats.field).toBe('@value');
            });
            it('with term agg and order by percentiles agg', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [{ type: 'percentiles', id: '1', field: '@value', settings: { percents: ['95', '99'] } }],
                    bucketAggs: [
                        {
                            type: 'terms',
                            field: '@host',
                            settings: { size: '5', order: 'asc', orderBy: '1[95.0]' },
                            id: '2',
                        },
                        { type: 'date_histogram', field: '@timestamp', id: '3' },
                    ],
                }, 100, '1000');
                var firstLevel = query.aggs['2'];
                var secondLevel = firstLevel.aggs['3'];
                expect(firstLevel.aggs['1'].percentiles.field).toBe('@value');
                expect(secondLevel.aggs['1'].percentiles.field).toBe('@value');
            });
            it('with term agg and valid min_doc_count', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [{ type: 'count', id: '1' }],
                    bucketAggs: [
                        {
                            type: 'terms',
                            field: '@host',
                            settings: { min_doc_count: '1' },
                            id: '2',
                        },
                        { type: 'date_histogram', field: '@timestamp', id: '3' },
                    ],
                }, 100, '1000');
                var firstLevel = query.aggs['2'];
                expect(firstLevel.terms.min_doc_count).toBe(1);
            });
            it('with term agg and variable as min_doc_count', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [{ type: 'count', id: '1' }],
                    bucketAggs: [
                        {
                            type: 'terms',
                            field: '@host',
                            settings: { min_doc_count: '$min_doc_count' },
                            id: '2',
                        },
                        { type: 'date_histogram', field: '@timestamp', id: '3' },
                    ],
                }, 100, '1000');
                var firstLevel = query.aggs['2'];
                expect(firstLevel.terms.min_doc_count).toBe('$min_doc_count');
            });
            it('with metric percentiles', function () {
                var percents = ['1', '2', '3', '4'];
                var field = '@load_time';
                var query = builder.build({
                    refId: 'A',
                    metrics: [
                        {
                            id: '1',
                            type: 'percentiles',
                            field: field,
                            settings: {
                                percents: percents,
                            },
                        },
                    ],
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
                }, 100, '1000');
                var firstLevel = query.aggs['3'];
                expect(firstLevel.aggs['1'].percentiles.field).toBe(field);
                expect(firstLevel.aggs['1'].percentiles.percents).toEqual(percents);
            });
            it('with filters aggs', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [{ type: 'count', id: '1' }],
                    timeField: '@timestamp',
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
                        { type: 'date_histogram', field: '@timestamp', id: '4' },
                    ],
                });
                expect(query.aggs['2'].filters.filters['@metric:cpu'].query_string.query).toBe('@metric:cpu');
                expect(query.aggs['2'].filters.filters['@metric:logins.count'].query_string.query).toBe('@metric:logins.count');
                expect(query.aggs['2'].aggs['4'].date_histogram.field).toBe('@timestamp');
            });
            it('should return correct query for raw_document metric', function () {
                var target = {
                    refId: 'A',
                    metrics: [{ type: 'raw_document', id: '1', settings: {} }],
                    timeField: '@timestamp',
                    bucketAggs: [],
                };
                var query = builder.build(target);
                expect(query).toMatchObject({
                    size: 500,
                    query: {
                        bool: {
                            filter: [
                                {
                                    range: {
                                        '@timestamp': {
                                            format: 'epoch_millis',
                                            gte: '$timeFrom',
                                            lte: '$timeTo',
                                        },
                                    },
                                },
                                {
                                    query_string: {
                                        analyze_wildcard: true,
                                        query: undefined,
                                    },
                                },
                            ],
                        },
                    },
                    sort: [{ '@timestamp': { order: 'desc', unmapped_type: 'boolean' } }, { _doc: { order: 'desc' } }],
                    script_fields: {},
                });
            });
            it('should set query size from settings when raw_documents', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [{ type: 'raw_document', id: '1', settings: { size: '1337' } }],
                    timeField: '@timestamp',
                    bucketAggs: [],
                });
                expect(query.size).toBe(1337);
            });
            it('with moving average', function () {
                var query = builder.build({
                    refId: 'A',
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
                        },
                    ],
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
                });
                var firstLevel = query.aggs['3'];
                expect(firstLevel.aggs['2']).not.toBe(undefined);
                expect(firstLevel.aggs['2'].moving_avg).not.toBe(undefined);
                expect(firstLevel.aggs['2'].moving_avg.buckets_path).toBe('3');
            });
            it('with moving average doc count', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [
                        {
                            id: '3',
                            type: 'count',
                        },
                        {
                            id: '2',
                            type: 'moving_avg',
                            field: '3',
                        },
                    ],
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '4' }],
                });
                var firstLevel = query.aggs['4'];
                expect(firstLevel.aggs['2']).not.toBe(undefined);
                expect(firstLevel.aggs['2'].moving_avg).not.toBe(undefined);
                expect(firstLevel.aggs['2'].moving_avg.buckets_path).toBe('_count');
            });
            it('with broken moving average', function () {
                var query = builder.build({
                    refId: 'A',
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
                        },
                        {
                            id: '4',
                            type: 'moving_avg',
                        },
                    ],
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
                });
                var firstLevel = query.aggs['3'];
                expect(firstLevel.aggs['2']).not.toBe(undefined);
                expect(firstLevel.aggs['2'].moving_avg).not.toBe(undefined);
                expect(firstLevel.aggs['2'].moving_avg.buckets_path).toBe('3');
                expect(firstLevel.aggs['4']).toBe(undefined);
            });
            it('with top_metrics', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [
                        {
                            id: '2',
                            type: 'top_metrics',
                            settings: {
                                order: 'desc',
                                orderBy: '@timestamp',
                                metrics: ['@value'],
                            },
                        },
                    ],
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
                });
                var firstLevel = query.aggs['3'];
                expect(firstLevel.aggs['2']).not.toBe(undefined);
                expect(firstLevel.aggs['2'].top_metrics).not.toBe(undefined);
                expect(firstLevel.aggs['2'].top_metrics.metrics).not.toBe(undefined);
                expect(firstLevel.aggs['2'].top_metrics.size).not.toBe(undefined);
                expect(firstLevel.aggs['2'].top_metrics.sort).not.toBe(undefined);
                expect(firstLevel.aggs['2'].top_metrics.metrics.length).toBe(1);
                expect(firstLevel.aggs['2'].top_metrics.metrics).toEqual([{ field: '@value' }]);
                expect(firstLevel.aggs['2'].top_metrics.sort).toEqual([{ '@timestamp': 'desc' }]);
                expect(firstLevel.aggs['2'].top_metrics.size).toBe(1);
            });
            it('with derivative', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [
                        {
                            id: '3',
                            type: 'sum',
                            field: '@value',
                        },
                        {
                            id: '2',
                            type: 'derivative',
                            field: '3',
                        },
                    ],
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
                });
                var firstLevel = query.aggs['3'];
                expect(firstLevel.aggs['2']).not.toBe(undefined);
                expect(firstLevel.aggs['2'].derivative).not.toBe(undefined);
                expect(firstLevel.aggs['2'].derivative.buckets_path).toBe('3');
            });
            it('with derivative doc count', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [
                        {
                            id: '3',
                            type: 'count',
                        },
                        {
                            id: '2',
                            type: 'derivative',
                            field: '3',
                        },
                    ],
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '4' }],
                });
                var firstLevel = query.aggs['4'];
                expect(firstLevel.aggs['2']).not.toBe(undefined);
                expect(firstLevel.aggs['2'].derivative).not.toBe(undefined);
                expect(firstLevel.aggs['2'].derivative.buckets_path).toBe('_count');
            });
            it('with serial_diff', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [
                        {
                            id: '3',
                            type: 'max',
                            field: '@value',
                        },
                        {
                            id: '2',
                            type: 'serial_diff',
                            field: '3',
                            settings: {
                                lag: '5',
                            },
                        },
                    ],
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
                });
                var firstLevel = query.aggs['3'];
                expect(firstLevel.aggs['2']).not.toBe(undefined);
                expect(firstLevel.aggs['2'].serial_diff).not.toBe(undefined);
                expect(firstLevel.aggs['2'].serial_diff.buckets_path).toBe('3');
                expect(firstLevel.aggs['2'].serial_diff.lag).toBe(5);
            });
            it('with bucket_script', function () {
                var query = builder.build({
                    refId: 'A',
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
                            id: '4',
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
                var firstLevel = query.aggs['2'];
                expect(firstLevel.aggs['4']).not.toBe(undefined);
                expect(firstLevel.aggs['4'].bucket_script).not.toBe(undefined);
                expect(firstLevel.aggs['4'].bucket_script.buckets_path).toMatchObject({ var1: '1', var2: '3' });
            });
            it('with bucket_script doc count', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [
                        {
                            id: '3',
                            type: 'count',
                        },
                        {
                            id: '4',
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
                var firstLevel = query.aggs['2'];
                expect(firstLevel.aggs['4']).not.toBe(undefined);
                expect(firstLevel.aggs['4'].bucket_script).not.toBe(undefined);
                expect(firstLevel.aggs['4'].bucket_script.buckets_path).toMatchObject({ var1: '_count' });
            });
            it('with histogram', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [{ id: '1', type: 'count' }],
                    bucketAggs: [
                        {
                            type: 'histogram',
                            field: 'bytes',
                            id: '3',
                            settings: {
                                interval: '10',
                                min_doc_count: '2',
                            },
                        },
                    ],
                });
                var firstLevel = query.aggs['3'];
                expect(firstLevel.histogram.field).toBe('bytes');
                expect(firstLevel.histogram.interval).toBe('10');
                expect(firstLevel.histogram.min_doc_count).toBe('2');
            });
            it('with adhoc filters', function () {
                var query = builder.build({
                    refId: 'A',
                    metrics: [{ type: 'count', id: '0' }],
                    timeField: '@timestamp',
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '3' }],
                }, [
                    { key: 'key1', operator: '=', value: 'value1' },
                    { key: 'key2', operator: '=', value: 'value2' },
                    { key: 'key2', operator: '!=', value: 'value2' },
                    { key: 'key3', operator: '<', value: 'value3' },
                    { key: 'key4', operator: '>', value: 'value4' },
                    { key: 'key5', operator: '=~', value: 'value5' },
                    { key: 'key6', operator: '!~', value: 'value6' },
                ]);
                expect(query.query.bool.must[0].match_phrase['key1'].query).toBe('value1');
                expect(query.query.bool.must[1].match_phrase['key2'].query).toBe('value2');
                expect(query.query.bool.must_not[0].match_phrase['key2'].query).toBe('value2');
                expect(query.query.bool.filter[2].range['key3'].lt).toBe('value3');
                expect(query.query.bool.filter[3].range['key4'].gt).toBe('value4');
                expect(query.query.bool.filter[4].regexp['key5']).toBe('value5');
                expect(query.query.bool.filter[5].bool.must_not.regexp['key6']).toBe('value6');
            });
            describe('getTermsQuery', function () {
                function testGetTermsQuery(queryDef) {
                    var query = builder.getTermsQuery(queryDef);
                    return query.aggs['1'].terms.order;
                }
                function checkSort(order, expected) {
                    if (lt(builder.esVersion, '6.0.0')) {
                        expect(order._term).toBe(expected);
                        expect(order._key).toBeUndefined();
                    }
                    else {
                        expect(order._term).toBeUndefined();
                        expect(order._key).toBe(expected);
                    }
                }
                it('should set correct default sorting', function () {
                    var order = testGetTermsQuery({});
                    checkSort(order, 'asc');
                    expect(order._count).toBeUndefined();
                });
                it('should set correct explicit sorting', function () {
                    var order = testGetTermsQuery({ order: 'desc' });
                    checkSort(order, 'desc');
                    expect(order._count).toBeUndefined();
                });
                it('getTermsQuery(orderBy:doc_count) should set desc sorting on _count', function () {
                    var query = builder.getTermsQuery({ orderBy: 'doc_count' });
                    expect(query.aggs['1'].terms.order._term).toBeUndefined();
                    expect(query.aggs['1'].terms.order._key).toBeUndefined();
                    expect(query.aggs['1'].terms.order._count).toBe('desc');
                });
                it('getTermsQuery(orderBy:doc_count, order:asc) should set asc sorting on _count', function () {
                    var query = builder.getTermsQuery({ orderBy: 'doc_count', order: 'asc' });
                    expect(query.aggs['1'].terms.order._term).toBeUndefined();
                    expect(query.aggs['1'].terms.order._key).toBeUndefined();
                    expect(query.aggs['1'].terms.order._count).toBe('asc');
                });
            });
            describe('getLogsQuery', function () {
                it('should return query with defaults', function () {
                    var query = builder.getLogsQuery({ refId: 'A' }, 500, null, '*');
                    expect(query.size).toEqual(500);
                    var expectedQuery = {
                        bool: {
                            filter: [{ range: { '@timestamp': { gte: '$timeFrom', lte: '$timeTo', format: 'epoch_millis' } } }],
                        },
                    };
                    expect(query.query).toEqual(expectedQuery);
                    expect(query.sort).toEqual([
                        { '@timestamp': { order: 'desc', unmapped_type: 'boolean' } },
                        { _doc: { order: 'desc' } },
                    ]);
                    var expectedAggs = {
                        // FIXME: It's pretty weak to include this '1' in the test as it's not part of what we are testing here and
                        // might change as a cause of unrelated changes
                        1: {
                            aggs: {},
                            date_histogram: {
                                extended_bounds: { max: '$timeTo', min: '$timeFrom' },
                                field: '@timestamp',
                                format: 'epoch_millis',
                                interval: '$__interval',
                                min_doc_count: 0,
                            },
                        },
                    };
                    expect(query.aggs).toMatchObject(expectedAggs);
                });
                it('with querystring', function () {
                    var query = builder.getLogsQuery({ refId: 'A', query: 'foo' }, 500, null, 'foo');
                    var expectedQuery = {
                        bool: {
                            filter: [
                                { range: { '@timestamp': { gte: '$timeFrom', lte: '$timeTo', format: 'epoch_millis' } } },
                                { query_string: { analyze_wildcard: true, query: 'foo' } },
                            ],
                        },
                    };
                    expect(query.query).toEqual(expectedQuery);
                });
                it('with adhoc filters', function () {
                    // TODO: Types for AdHocFilters
                    var adhocFilters = [
                        { key: 'key1', operator: '=', value: 'value1' },
                        { key: 'key2', operator: '!=', value: 'value2' },
                        { key: 'key3', operator: '<', value: 'value3' },
                        { key: 'key4', operator: '>', value: 'value4' },
                        { key: 'key5', operator: '=~', value: 'value5' },
                        { key: 'key6', operator: '!~', value: 'value6' },
                    ];
                    var query = builder.getLogsQuery({ refId: 'A' }, 500, adhocFilters, '*');
                    expect(query.query.bool.must[0].match_phrase['key1'].query).toBe('value1');
                    expect(query.query.bool.must_not[0].match_phrase['key2'].query).toBe('value2');
                    expect(query.query.bool.filter[1].range['key3'].lt).toBe('value3');
                    expect(query.query.bool.filter[2].range['key4'].gt).toBe('value4');
                    expect(query.query.bool.filter[3].regexp['key5']).toBe('value5');
                    expect(query.query.bool.filter[4].bool.must_not.regexp['key6']).toBe('value6');
                });
            });
        });
    });
    describe('Value casting for settings', function () {
        it('correctly casts values in moving_avg ', function () {
            var query = builder7x.build({
                refId: 'A',
                metrics: [
                    { type: 'avg', id: '2' },
                    {
                        type: 'moving_avg',
                        id: '3',
                        field: '2',
                        settings: {
                            window: '5',
                            model: 'holt_winters',
                            predict: '10',
                            settings: {
                                alpha: '1',
                                beta: '2',
                                gamma: '3',
                                period: '4',
                            },
                        },
                    },
                ],
                timeField: '@timestamp',
                bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
            });
            var movingAvg = query.aggs['1'].aggs['3'].moving_avg;
            expect(movingAvg.window).toBe(5);
            expect(movingAvg.predict).toBe(10);
            expect(movingAvg.settings.alpha).toBe(1);
            expect(movingAvg.settings.beta).toBe(2);
            expect(movingAvg.settings.gamma).toBe(3);
            expect(movingAvg.settings.period).toBe(4);
        });
        it('correctly casts values in serial_diff ', function () {
            var query = builder7x.build({
                refId: 'A',
                metrics: [
                    { type: 'avg', id: '2' },
                    {
                        type: 'serial_diff',
                        id: '3',
                        field: '2',
                        settings: {
                            lag: '1',
                        },
                    },
                ],
                timeField: '@timestamp',
                bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
            });
            var serialDiff = query.aggs['1'].aggs['3'].serial_diff;
            expect(serialDiff.lag).toBe(1);
        });
    });
});
//# sourceMappingURL=query_builder.test.js.map
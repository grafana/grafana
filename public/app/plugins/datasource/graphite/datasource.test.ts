import { isArray } from 'lodash';
import { of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { AbstractLabelMatcher, AbstractLabelOperator, getFrameDisplayName, dateTime } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TemplateSrv } from 'app/features/templating/template_srv';

import { fromString } from './configuration/parseLokiLabelMappings';
import { GraphiteDatasource } from './datasource';
import { GraphiteQuery, GraphiteQueryType } from './types';
import { DEFAULT_GRAPHITE_VERSION } from './versions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

interface Context {
  templateSrv: TemplateSrv;
  ds: GraphiteDatasource;
}

describe('graphiteDatasource', () => {
  const fetchMock = jest.spyOn(backendSrv, 'fetch');

  let ctx = {} as Context;

  beforeEach(() => {
    jest.clearAllMocks();

    const instanceSettings = {
      url: '/api/datasources/proxy/1',
      name: 'graphiteProd',
      jsonData: {
        rollupIndicatorEnabled: true,
      },
    };
    const templateSrv = new TemplateSrv();
    const ds = new GraphiteDatasource(instanceSettings, templateSrv);
    ctx = { templateSrv, ds };
  });

  it('uses default Graphite version when no graphiteVersion is provided', () => {
    expect(ctx.ds.graphiteVersion).toBe(DEFAULT_GRAPHITE_VERSION);
  });

  describe('convertResponseToDataFrames', () => {
    it('should transform regular result', () => {
      const result = ctx.ds.convertResponseToDataFrames({
        data: {
          meta: {
            stats: {
              'executeplan.cache-hit-partial.count': 5,
              'executeplan.cache-hit.count': 10,
            },
          },
          series: [
            {
              target: 'seriesA',
              datapoints: [
                [100, 200],
                [101, 201],
              ],
              meta: [
                {
                  'aggnum-norm': 1,
                  'aggnum-rc': 7,
                  'archive-interval': 3600,
                  'archive-read': 1,
                  'consolidator-normfetch': 'AverageConsolidator',
                  'consolidator-rc': 'AverageConsolidator',
                  count: 1,
                  'schema-name': 'wpUsageMetrics',
                  'schema-retentions': '1h:35d:6h:2,2h:2y:6h:2',
                },
              ],
            },
            {
              target: 'seriesB',
              meta: [
                {
                  'aggnum-norm': 1,
                  'aggnum-rc': 0,
                  'archive-interval': 3600,
                  'archive-read': 0,
                  'consolidator-normfetch': 'AverageConsolidator',
                  'consolidator-rc': 'NoneConsolidator',
                  count: 1,
                  'schema-name': 'wpUsageMetrics',
                  'schema-retentions': '1h:35d:6h:2,2h:2y:6h:2',
                },
              ],
              datapoints: [
                [200, 300],
                [201, 301],
              ],
            },
          ],
        },
      });

      expect(result.data.length).toBe(2);
      expect(getFrameDisplayName(result.data[0])).toBe('seriesA');
      expect(getFrameDisplayName(result.data[1])).toBe('seriesB');
      expect(result.data[0].length).toBe(2);
      expect(result.data[0].meta.notices.length).toBe(1);
      expect(result.data[0].meta.notices[0].text).toBe('Data is rolled up, aggregated over 2h using Average function');
      expect(result.data[1].meta.notices).toBeUndefined();
    });
  });

  describe('When querying graphite with one target using query editor target spec', () => {
    const query = {
      panelId: 3,
      dashboardId: 5,
      range: { from: dateTime('2022-04-01T00:00:00'), to: dateTime('2022-07-01T00:00:00') },
      targets: [{ target: 'prod1.count' }, { target: 'prod2.count' }],
      maxDataPoints: 500,
    };

    let response: any;
    let requestOptions: any;

    beforeEach(() => {
      fetchMock.mockImplementation((options: any) => {
        requestOptions = options;
        return of(
          createFetchResponse([
            {
              target: 'prod1.count',
              datapoints: [
                [10, 1],
                [12, 1],
              ],
            },
          ])
        );
      });

      response = ctx.ds.query(query as any);
    });

    it('X-Dashboard and X-Panel headers to be set!', () => {
      expect(requestOptions.headers['X-Dashboard-Id']).toBe(5);
      expect(requestOptions.headers['X-Panel-Id']).toBe(3);
    });

    it('should generate the correct query', () => {
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/render');
    });

    it('should set unique requestId', () => {
      expect(requestOptions.requestId).toBe('graphiteProd.panelId.3');
    });

    it('should query correctly', () => {
      const params = requestOptions.data.split('&');
      expect(params).toContain('target=prod1.count');
      expect(params).toContain('target=prod2.count');
      expect(params).toContain('from=1648789200');
      expect(params).toContain('until=1656655200');
    });

    it('should exclude undefined params', () => {
      const params = requestOptions.data.split('&');
      expect(params).not.toContain('cacheTimeout=undefined');
    });

    it('should return series list', async () => {
      await expect(response).toEmitValuesWith((values: any) => {
        const results = values[0];
        expect(results.data.length).toBe(1);
        expect(results.data[0].name).toBe('prod1.count');
      });
    });

    it('should convert to millisecond resolution', async () => {
      await expect(response).toEmitValuesWith((values: any) => {
        const results = values[0];
        expect(results.data[0].fields[1].values[0]).toBe(10);
      });
    });
  });

  describe('when fetching Graphite Events as annotations', () => {
    let results: any;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    const options = {
      targets: [
        {
          fromAnnotations: true,
          tags: ['tag1'],
          queryType: 'tags',
        },
      ],

      range: {
        from: '2022-06-06T07:03:03.109Z',
        to: '2022-06-07T07:03:03.109Z',
        raw: {
          from: '2022-06-06T07:03:03.109Z',
          to: '2022-06-07T07:03:03.109Z',
        },
      },
    };

    describe('and tags are returned as string', () => {
      const response = [
        {
          when: 1507222850,
          tags: 'tag1 tag2',
          data: 'some text',
          id: 2,
          what: 'Event - deploy',
        },
      ];

      beforeEach(async () => {
        fetchMock.mockImplementation((options: any) => {
          return of(createFetchResponse(response));
        });
        await ctx.ds.annotationEvents(options.range, options.targets[0]).then((data: any) => {
          results = data;
        });
      });

      it('should parse the tags string into an array', () => {
        expect(isArray(results[0].tags)).toEqual(true);
        expect(results[0].tags.length).toEqual(2);
        expect(results[0].tags[0]).toEqual('tag1');
        expect(results[0].tags[1]).toEqual('tag2');
      });
    });

    describe('and tags are returned as an array', () => {
      const response = [
        {
          when: 1507222850,
          tags: ['tag1', 'tag2'],
          data: 'some text',
          id: 2,
          what: 'Event - deploy',
        },
      ];

      beforeEach(async () => {
        fetchMock.mockImplementation((options: any) => {
          return of(createFetchResponse(response));
        });

        await ctx.ds.annotationEvents(options.range, options.targets[0]).then((data: any) => {
          results = data;
        });
      });

      it('should parse the tags string into an array', () => {
        expect(isArray(results[0].tags)).toEqual(true);
        expect(results[0].tags.length).toEqual(2);
        expect(results[0].tags[0]).toEqual('tag1');
        expect(results[0].tags[1]).toEqual('tag2');
      });
    });

    it('and tags response is invalid', async () => {
      fetchMock.mockImplementation((options: any) => {
        return of(createFetchResponse('zzzzzzz'));
      });
      await ctx.ds.annotationEvents(options.range, options.targets[0]).then((data: any) => {
        results = data;
      });
      expect(results).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/Unable to get annotations/));
    });
  });

  describe('when fetching Graphite function descriptions', () => {
    // `"default": Infinity` (invalid JSON) in params passed by Graphite API in 1.1.7
    const INVALID_JSON =
      '{"testFunction":{"name":"function","description":"description","module":"graphite.render.functions","group":"Transform","params":[{"name":"param","type":"intOrInf","required":true,"default":Infinity}]}}';

    it('should parse the response with an invalid JSON', async () => {
      fetchMock.mockImplementation(() => {
        return of(createFetchResponse(INVALID_JSON));
      });
      const funcDefs = await ctx.ds.getFuncDefs();
      expect(funcDefs).toEqual({
        testFunction: {
          category: 'Transform',
          defaultParams: ['inf'],
          description: 'description',
          fake: true,
          name: 'function',
          params: [
            {
              multiple: false,
              name: 'param',
              optional: false,
              options: undefined,
              type: 'int_or_infinity',
            },
          ],
        },
      });
    });
  });

  describe('building graphite params', () => {
    it('should return empty array if no targets', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{}],
      });
      expect(results.length).toBe(0);
    });

    it('should uri escape targets', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: 'prod1.{test,test2}' }, { target: 'prod2.count' }],
      });
      expect(results).toContain('target=prod1.%7Btest%2Ctest2%7D');
    });

    it('should replace target placeholder', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: 'series1' }, { target: 'series2' }, { target: 'asPercent(#A,#B)' }],
      });
      expect(results[2]).toBe('target=asPercent(series1%2Cseries2)');
    });

    it('should replace target placeholder for hidden series', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [
          { target: 'series1', hide: true },
          { target: 'sumSeries(#A)', hide: true },
          { target: 'asPercent(#A,#B)' },
        ],
      });
      expect(results[0]).toBe('target=' + encodeURIComponent('asPercent(series1,sumSeries(series1))'));
    });

    it('should replace target placeholder when nesting query references', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: 'series1' }, { target: 'sumSeries(#A)' }, { target: 'asPercent(#A,#B)' }],
      });
      expect(results[2]).toBe('target=' + encodeURIComponent('asPercent(series1,sumSeries(series1))'));
    });

    it('should fix wrong minute interval parameters', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: "summarize(prod.25m.count, '25m', 'sum')" }],
      });
      expect(results[0]).toBe('target=' + encodeURIComponent("summarize(prod.25m.count, '25min', 'sum')"));
    });

    it('should fix wrong month interval parameters', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: "summarize(prod.5M.count, '5M', 'sum')" }],
      });
      expect(results[0]).toBe('target=' + encodeURIComponent("summarize(prod.5M.count, '5mon', 'sum')"));
    });

    it('should ignore empty targets', () => {
      const results = ctx.ds.buildGraphiteParams({
        targets: [{ target: 'series1' }, { target: '' }],
      });
      expect(results.length).toBe(2);
    });

    describe('when formatting targets', () => {
      it('does not attempt to glob for one variable', () => {
        ctx.templateSrv.init([
          {
            type: 'query',
            name: 'metric',
            current: { value: ['b'] },
          },
        ]);

        const results = ctx.ds.buildGraphiteParams({
          targets: [{ target: 'my.$metric.*' }],
        });
        expect(results).toStrictEqual(['target=my.b.*', 'format=json']);
      });

      it('globs for more than one variable', () => {
        ctx.templateSrv.init([
          {
            type: 'query',
            name: 'metric',
            current: { value: ['a', 'b'] },
          },
        ]);

        const results = ctx.ds.buildGraphiteParams({
          targets: [{ target: 'my.[[metric]].*' }],
        });

        expect(results).toStrictEqual(['target=my.%7Ba%2Cb%7D.*', 'format=json']);
      });
    });
  });

  describe('querying for template variables', () => {
    let results: any;
    let requestOptions: any;

    beforeEach(() => {
      fetchMock.mockImplementation((options: any) => {
        requestOptions = options;
        return of(createFetchResponse(['backend_01', 'backend_02']));
      });
    });

    it('should generate tags query', () => {
      ctx.ds.metricFindQuery('tags()').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
      expect(requestOptions.params.expr).toEqual([]);
      expect(results).not.toBe(null);
    });

    it('should generate tags query with a filter expression', () => {
      ctx.ds.metricFindQuery('tags(server=backend_01)').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
      expect(requestOptions.params.expr).toEqual(['server=backend_01']);
      expect(results).not.toBe(null);
    });

    it('should generate tags query for an expression with whitespace after', () => {
      ctx.ds.metricFindQuery('tags(server=backend_01 )').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
      expect(requestOptions.params.expr).toEqual(['server=backend_01']);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for one tag', () => {
      ctx.ds.metricFindQuery('tag_values(server)').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params.tag).toBe('server');
      expect(requestOptions.params.expr).toEqual([]);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for a tag and expression', () => {
      ctx.ds.metricFindQuery('tag_values(server,server=~backend*)').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params.tag).toBe('server');
      expect(requestOptions.params.expr).toEqual(['server=~backend*']);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for a tag with whitespace after', () => {
      ctx.ds.metricFindQuery('tag_values(server )').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params.tag).toBe('server');
      expect(requestOptions.params.expr).toEqual([]);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for a tag and expression with whitespace after', () => {
      ctx.ds.metricFindQuery('tag_values(server , server=~backend* )').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params.tag).toBe('server');
      expect(requestOptions.params.expr).toEqual(['server=~backend*']);
      expect(results).not.toBe(null);
    });

    it('/metrics/find should be POST', () => {
      ctx.templateSrv.init([
        {
          type: 'query',
          name: 'foo',
          current: { value: ['bar'] },
        },
      ]);
      ctx.ds.metricFindQuery('[[foo]]').then((data: any) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(requestOptions.method).toEqual('POST');
      expect(requestOptions.headers).toHaveProperty('Content-Type', 'application/x-www-form-urlencoded');
      expect(requestOptions.data).toMatch(`query=bar`);
      expect(requestOptions).toHaveProperty('params');
    });

    it('should interpolate $__searchFilter with searchFilter', () => {
      ctx.ds.metricFindQuery('app.$__searchFilter', { searchFilter: 'backend' }).then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(requestOptions.params).toEqual({});
      expect(requestOptions.data).toEqual('query=app.backend*');
      expect(results).not.toBe(null);
    });

    it('should interpolate $__searchFilter with default when searchFilter is missing', () => {
      ctx.ds.metricFindQuery('app.$__searchFilter', {}).then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(requestOptions.params).toEqual({});
      expect(requestOptions.data).toEqual('query=app.*');
      expect(results).not.toBe(null);
    });

    it('should request expanded metrics', () => {
      ctx.ds.metricFindQuery('expand(*.servers.*)').then((data: any) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/expand');
      expect(requestOptions.params.query).toBe('*.servers.*');
      expect(results).not.toBe(null);
    });

    it('should fetch from /metrics/find endpoint when queryType is default or query is string', async () => {
      const stringQuery = 'query';
      ctx.ds.metricFindQuery(stringQuery).then((data: any) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(results).not.toBe(null);

      const objectQuery = {
        queryType: GraphiteQueryType.Default,
        target: 'query',
        refId: 'A',
        datasource: ctx.ds,
      };
      const data = await ctx.ds.metricFindQuery(objectQuery);
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(data).toBeTruthy();
    });

    it('should fetch from /render endpoint when queryType is value', async () => {
      fetchMock.mockImplementation((options: any) => {
        requestOptions = options;
        return of(
          createFetchResponse([
            {
              target: 'query',
              datapoints: [
                [10, 1],
                [12, 1],
              ],
            },
          ])
        );
      });

      const fq: GraphiteQuery = {
        queryType: GraphiteQueryType.Value,
        target: 'query',
        refId: 'A',
        datasource: ctx.ds,
      };
      const data = await ctx.ds.metricFindQuery(fq);
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/render');
      expect(data).toBeTruthy();
    });

    it('should return values of a query when queryType is GraphiteQueryType.Value', async () => {
      fetchMock.mockImplementation((options: any) => {
        requestOptions = options;
        return of(
          createFetchResponse([
            {
              target: 'query',
              datapoints: [
                [10, 1],
                [12, 1],
              ],
            },
          ])
        );
      });

      const fq: GraphiteQuery = {
        queryType: GraphiteQueryType.Value,
        target: 'query',
        refId: 'A',
        datasource: ctx.ds,
      };
      const data = await ctx.ds.metricFindQuery(fq);
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/render');
      expect(data[0].value).toBe(10);
      expect(data[0].text).toBe('10');
      expect(data[1].value).toBe(12);
      expect(data[1].text).toBe('12');
    });

    it('should return metric names when queryType is GraphiteQueryType.MetricName', async () => {
      fetchMock.mockImplementation((options: any) => {
        requestOptions = options;
        return of(
          createFetchResponse([
            {
              target: 'apps.backend.backend_01',
              datapoints: [
                [10, 1],
                [12, 1],
              ],
            },
            {
              target: 'apps.backend.backend_02',
              datapoints: [
                [10, 1],
                [12, 1],
              ],
            },
          ])
        );
      });

      const fq: GraphiteQuery = {
        queryType: GraphiteQueryType.MetricName,
        target: 'apps.backend.*',
        refId: 'A',
        datasource: ctx.ds,
      };
      const data = await ctx.ds.metricFindQuery(fq);
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/render');
      expect(data[0].text).toBe('apps.backend.backend_01');
      expect(data[1].text).toBe('apps.backend.backend_02');
    });
  });

  describe('exporting to abstract query', () => {
    async function assertQueryExport(target: string, labelMatchers: AbstractLabelMatcher[]): Promise<void> {
      let abstractQueries = await ctx.ds.exportToAbstractQueries([
        {
          refId: 'A',
          target,
        },
      ]);
      expect(abstractQueries).toMatchObject([
        {
          refId: 'A',
          labelMatchers: labelMatchers,
        },
      ]);
    }

    beforeEach(() => {
      ctx.ds.getImportQueryConfiguration = jest.fn().mockReturnValue({
        loki: {
          mappings: ['servers.(cluster).(server).*'].map(fromString),
        },
      });

      ctx.ds.createFuncInstance = jest.fn().mockImplementation((name: string) => ({
        name,
        params: [],
        def: {
          name,
          params: [{ multiple: true }],
        },
        updateText: () => {},
      }));
    });

    it('extracts metric name based on configuration', async () => {
      await assertQueryExport('interpolate(alias(servers.west.001.cpu,1,2))', [
        { name: 'cluster', operator: AbstractLabelOperator.Equal, value: 'west' },
        { name: 'server', operator: AbstractLabelOperator.Equal, value: '001' },
      ]);

      await assertQueryExport('interpolate(alias(servers.east.001.request.POST.200,1,2))', [
        { name: 'cluster', operator: AbstractLabelOperator.Equal, value: 'east' },
        { name: 'server', operator: AbstractLabelOperator.Equal, value: '001' },
      ]);

      await assertQueryExport('interpolate(alias(servers.*.002.*,1,2))', [
        { name: 'server', operator: AbstractLabelOperator.Equal, value: '002' },
      ]);
    });

    it('extracts tags', async () => {
      await assertQueryExport("interpolate(seriesByTag('cluster=west', 'server=002'), inf))", [
        { name: 'cluster', operator: AbstractLabelOperator.Equal, value: 'west' },
        { name: 'server', operator: AbstractLabelOperator.Equal, value: '002' },
      ]);
      await assertQueryExport("interpolate(seriesByTag('foo=bar', 'server=002'), inf))", [
        { name: 'foo', operator: AbstractLabelOperator.Equal, value: 'bar' },
        { name: 'server', operator: AbstractLabelOperator.Equal, value: '002' },
      ]);
    });

    it('extracts regular expressions', async () => {
      await assertQueryExport('interpolate(alias(servers.eas*.{001,002}.request.POST.200,1,2))', [
        { name: 'cluster', operator: AbstractLabelOperator.EqualRegEx, value: '^eas.*' },
        { name: 'server', operator: AbstractLabelOperator.EqualRegEx, value: '^(001|002)' },
      ]);
    });

    it('does not extract metrics when the config does not match', async () => {
      await assertQueryExport('interpolate(alias(test.west.001.cpu))', []);
      await assertQueryExport('interpolate(alias(servers.west.001))', []);
    });
  });
});

function accessScenario(name: string, url: string, fn: any) {
  describe('access scenario ' + name, () => {
    const ctx: any = {
      // @ts-ignore
      templateSrv: new TemplateSrv(),
      instanceSettings: { url: 'url', name: 'graphiteProd', jsonData: {} },
    };

    const httpOptions = {
      headers: {},
    };

    describe('when using proxy mode', () => {
      const options = { dashboardId: 1, panelId: 2 };

      it('tracing headers should be added', () => {
        ctx.instanceSettings.url = url;
        const ds = new GraphiteDatasource(ctx.instanceSettings, ctx.templateSrv);
        ds.addTracingHeaders(httpOptions, options);
        fn(httpOptions);
      });
    });
  });
}

accessScenario('with proxy access', '/api/datasources/proxy/1', (httpOptions: any) => {
  expect(httpOptions.headers['X-Dashboard-Id']).toBe(1);
  expect(httpOptions.headers['X-Panel-Id']).toBe(2);
});

accessScenario('with direct access', 'http://localhost:8080', (httpOptions: any) => {
  expect(httpOptions.headers['X-Dashboard-Id']).toBe(undefined);
  expect(httpOptions.headers['X-Panel-Id']).toBe(undefined);
});

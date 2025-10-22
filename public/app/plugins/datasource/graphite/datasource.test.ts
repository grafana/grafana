import { isArray } from 'lodash';
import moment from 'moment';
import { Observable, of } from 'rxjs';

import {
  AbstractLabelMatcher,
  AbstractLabelOperator,
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  dateMath,
  dateTime,
  getFrameDisplayName,
  MetricFindValue,
  PluginType,
  ScopedVars,
} from '@grafana/data';
import {
  BackendSrvRequest,
  config,
  FetchResponse,
  getTemplateSrv,
  TemplateSrv,
  VariableInterpolation,
} from '@grafana/runtime';

import { fromString } from './configuration/parseLokiLabelMappings';
import { GraphiteDatasource } from './datasource';
import { GraphiteQuery, GraphiteQueryType, GraphiteType } from './types';
import { DEFAULT_GRAPHITE_VERSION } from './versions';

const fetchMock = jest.fn();
const postResourceMock = jest.fn();
const getResourceMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => ({
    fetch: fetchMock,
  }),
  getTemplateSrv: () => {
    return {
      replace: (s: string) => s,
    };
  },
}));

interface Context {
  templateSrv: TemplateSrv;
  ds: GraphiteDatasource;
}

const createFetchResponse = <T>(data: T): FetchResponse<T> => ({
  data,
  status: 200,
  url: 'http://localhost:3000/api/query',
  config: { url: 'http://localhost:3000/api/query' },
  type: 'basic',
  statusText: 'Ok',
  redirected: false,
  headers: new Headers(),
  ok: true,
});

const instanceSettings = {
  id: 1,
  uid: 'graphiteUid',
  type: 'graphite',
  readOnly: false,
  access: 'proxy' as 'proxy',
  meta: {
    id: '1',
    name: 'graphite',
    type: PluginType.datasource,
    info: {
      description: 'Graphite datasource',
      author: {
        name: 'Grafana Labs',
        url: 'https://grafana.com',
      },
      keywords: ['graphite', 'datasource'],
      links: [],
      logos: {
        large: '',
        small: '',
      },
      screenshots: [],
      updated: '',
      version: '',
    },
    module: '',
    baseUrl: '',
  },
  url: '/api/datasources/proxy/1',
  name: 'graphiteProd',
  jsonData: {
    rollupIndicatorEnabled: true,
    graphiteType: GraphiteType.Default,
  },
};

describe('graphiteDatasource', () => {
  let ctx = {} as Context;

  beforeEach(() => {
    jest.clearAllMocks();

    const templateSrv = getTemplateSrv();
    const ds = new GraphiteDatasource(instanceSettings, templateSrv);
    ds.postResource = postResourceMock;
    ds.getResource = getResourceMock;

    ctx = { templateSrv, ds };
  });

  it('uses default Graphite version when no graphiteVersion is provided', () => {
    expect(ctx.ds.graphiteVersion).toBe(DEFAULT_GRAPHITE_VERSION);
  });

  describe('convertResponseToDataFrames', () => {
    it('should transform regular result', () => {
      const refIDMap = {
        refIDA: 'A',
        refIDB: 'B',
      };
      const result = ctx.ds.convertResponseToDataFrames(
        createFetchResponse({
          meta: {
            stats: {
              'executeplan.cache-hit-partial.count': 5,
              'executeplan.cache-hit.count': 10,
            },
          },
          series: [
            {
              target: 'seriesA refIDA',
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
              target: 'seriesB refIDB',
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
        }),
        refIDMap
      );

      expect(result.data.length).toBe(2);
      expect(getFrameDisplayName(result.data[0])).toBe('seriesA');
      expect(getFrameDisplayName(result.data[1])).toBe('seriesB');
      expect(result.data[0].length).toBe(2);
      expect(result.data[0].meta.notices.length).toBe(1);
      expect(result.data[0].refId).toBe('A');
      expect(result.data[0].meta.notices[0].text).toBe('Data is rolled up, aggregated over 2h using Average function');
      expect(result.data[1].meta.notices).toBeUndefined();
      expect(result.data[1].refId).toBe('B');
    });
    it('handles series with spaces in the name', () => {
      const refIDMap = {
        refIDA: 'A',
        refIDB: 'B',
      };
      const result = ctx.ds.convertResponseToDataFrames(
        createFetchResponse({
          meta: {
            stats: {
              'executeplan.cache-hit-partial.count': 5,
              'executeplan.cache-hit.count': 10,
            },
          },
          series: [
            {
              target: 'series A with spaces refIDA',
              datapoints: [
                [100, 200],
                [101, 201],
              ],
            },
            {
              target: 'series B with spaces refIDB',
              datapoints: [
                [200, 300],
                [201, 301],
              ],
            },
          ],
        }),
        refIDMap
      );

      expect(result.data.length).toBe(2);
      expect(getFrameDisplayName(result.data[0])).toBe('series A with spaces');
      expect(getFrameDisplayName(result.data[1])).toBe('series B with spaces');
      expect(result.data[0].length).toBe(2);
      expect(result.data[0].refId).toBe('A');
      expect(result.data[1].refId).toBe('B');
    });
  });

  describe('When querying graphite with one target using query editor target spec', () => {
    let response: Observable<DataQueryResponse>;
    let requestOptions: BackendSrvRequest;

    beforeEach(() => {
      const query: DataQueryRequest<GraphiteQuery> = {
        panelId: 3,
        dashboardUID: '5',
        range: {
          from: dateTime('2022-04-01T00:00:00'),
          to: dateTime('2022-07-01T00:00:00'),
          raw: {
            from: '1648789200',
            to: '1656655200',
          },
        },
        targets: [
          { target: 'prod1.count', refId: 'A' },
          { target: 'prod2.count', refId: 'B' },
        ],
        maxDataPoints: 500,
        requestId: '',
        interval: '1m',
        intervalMs: 60000,
        scopedVars: {},
        timezone: 'utc',
        app: CoreApp.Dashboard,
        startTime: 0,
      };
      fetchMock.mockImplementation((options) => {
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

      response = ctx.ds.query(query);
    });

    it('X-Dashboard and X-Panel headers to be set!', () => {
      expect(requestOptions.headers?.['X-Dashboard-Id']).toBe('5');
      expect(requestOptions.headers?.['X-Panel-Id']).toBe(3);
    });

    it('should generate the correct query', () => {
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/render');
    });

    it('should set unique requestId', () => {
      expect(requestOptions.requestId).toBe('graphiteProd.panelId.3');
    });

    it('should query correctly', () => {
      const params = requestOptions.data.split('&');
      expect(params).toContain(`target=${encodeURIComponent(`aliasSub(prod1.count, "(^.*$)", "\\1 A")`)}`);
      expect(params).toContain(`target=${encodeURIComponent(`aliasSub(prod2.count, "(^.*$)", "\\1 B")`)}`);
      expect(params).toContain('from=1648789200');
      expect(params).toContain('until=1656655200');
    });

    it('should exclude undefined params', () => {
      const params = requestOptions.data.split('&');
      expect(params).not.toContain('cacheTimeout=undefined');
    });

    it('should return series list', async () => {
      await expect(response).toEmitValuesWith((values: DataQueryResponse[]) => {
        const results = values[0];
        expect(results.data.length).toBe(1);
        expect(results.data[0].name).toBe('prod1.count');
      });
    });

    it('should convert to millisecond resolution', async () => {
      await expect(response).toEmitValuesWith((values: DataQueryResponse[]) => {
        const results = values[0];
        expect(results.data[0].fields[1].values[0]).toBe(10);
      });
    });
  });

  describe('when fetching Graphite Events as annotations', () => {
    let results: Array<{
      annotation: string;
      time: string;
      title: string;
      tags?: string[];
    }>;
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
          refId: 'Anno',
        },
      ],

      range: {
        from: dateTime('2022-06-06T07:03:03.109Z'),
        to: dateTime('2022-06-07T07:03:03.109Z'),
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
        fetchMock.mockImplementation((options) => {
          return of(createFetchResponse(response));
        });
        await ctx.ds.annotationEvents(options.range, options.targets[0]).then((data) => {
          results = data;
        });
      });

      it('should parse the tags string into an array', () => {
        expect(isArray(results[0].tags)).toEqual(true);
        if (!results[0].tags) {
          throw new Error('tags not defined');
        }
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
        fetchMock.mockImplementation((options) => {
          return of(createFetchResponse(response));
        });

        await ctx.ds.annotationEvents(options.range, options.targets[0]).then((data) => {
          results = data;
        });
      });

      it('should parse the tags string into an array', () => {
        expect(isArray(results[0].tags)).toEqual(true);
        if (!results[0].tags) {
          throw new Error('tags not defined');
        }
        expect(results[0].tags.length).toEqual(2);
        expect(results[0].tags[0]).toEqual('tag1');
        expect(results[0].tags[1]).toEqual('tag2');
      });
    });

    it('and tags response is invalid', async () => {
      fetchMock.mockImplementation((options) => {
        return of(createFetchResponse('zzzzzzz'));
      });
      await ctx.ds.annotationEvents(options.range, options.targets[0]).then((data) => {
        results = data;
      });
      expect(results).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/Unable to get annotations/));
    });
  });

  describe('when fetching Graphite Events as annotations (backend)', () => {
    let results: Array<{
      annotation: string;
      time: string;
      title: string;
      tags?: string[];
    }>;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation();
      config.featureToggles.graphiteBackendMode = true;
    });

    afterEach(() => {
      errorSpy.mockRestore();
      config.featureToggles.graphiteBackendMode = false;
    });

    const options = {
      targets: [
        {
          fromAnnotations: true,
          tags: ['tag1'],
          queryType: 'tags',
          refId: 'Anno',
        },
      ],

      range: {
        from: dateTime('2022-06-06T07:03:03.109Z'),
        to: dateTime('2022-06-07T07:03:03.109Z'),
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
        postResourceMock.mockImplementation((options) => {
          return createFetchResponse(response);
        });
        await ctx.ds.annotationEvents(options.range, options.targets[0]).then((data) => {
          results = data;
        });
      });

      it('should parse the tags string into an array', () => {
        expect(isArray(results[0].tags)).toEqual(true);
        if (!results[0].tags) {
          throw new Error('tags not defined');
        }
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
        fetchMock.mockImplementation((options) => {
          return of(createFetchResponse(response));
        });

        await ctx.ds.annotationEvents(options.range, options.targets[0]).then((data) => {
          results = data;
        });
      });

      it('should parse the tags string into an array', () => {
        expect(isArray(results[0].tags)).toEqual(true);
        if (!results[0].tags) {
          throw new Error('tags not defined');
        }
        expect(results[0].tags.length).toEqual(2);
        expect(results[0].tags[0]).toEqual('tag1');
        expect(results[0].tags[1]).toEqual('tag2');
      });
    });

    it('and tags response is invalid', async () => {
      postResourceMock.mockImplementation((options) => {
        return createFetchResponse('zzzzzzz');
      });
      await ctx.ds.annotationEvents(options.range, options.targets[0]).then((data) => {
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
    const defaultQueryProperties = {
      from: 'now-1h',
      until: 'now',
      format: 'json',
    };
    it('should return empty array if no targets', () => {
      const originalTargetMap = { A: '' };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results.length).toBe(0);
    });

    it('should uri escape targets', () => {
      const originalTargetMap = {
        A: 'prod1.{test,test2}',
        B: 'prod2.count',
      };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [
            { target: 'prod1.{test,test2}', refId: 'A' },
            { target: 'prod2.count', refId: 'B' },
          ],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results).toContain('target=prod1.%7Btest%2Ctest2%7D');
    });

    it('should replace target placeholder', () => {
      const originalTargetMap = {
        A: 'series1',
        B: 'series2',
        C: 'asPercent(#A,#B)',
      };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [
            { target: 'series1', refId: 'A' },
            { target: 'series2', refId: 'B' },
            { target: 'asPercent(#A,#B)', refId: 'C ' },
          ],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results[2]).toBe('target=asPercent(series1%2Cseries2)');
    });

    it('should replace target placeholder for hidden series', () => {
      const originalTargetMap = {
        A: 'series1',
        B: 'sumSeries(#A)',
        C: 'asPercent(#A,#B)',
      };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [
            { target: 'series1', hide: true, refId: 'A' },
            { target: 'sumSeries(#A)', hide: true, refId: 'B' },
            { target: 'asPercent(#A,#B)', refId: 'C' },
          ],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results[0]).toBe('target=' + encodeURIComponent('asPercent(series1,sumSeries(series1))'));
    });

    it('should replace target placeholder when nesting query references', () => {
      const originalTargetMap = {
        A: 'series1',
        B: 'sumSeries(#A)',
        C: 'asPercent(#A,#B)',
      };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [
            { target: 'series1', refId: 'A' },
            { target: 'sumSeries(#A)', refId: 'B' },
            { target: 'asPercent(#A,#B)', refId: 'C' },
          ],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results[2]).toBe('target=' + encodeURIComponent('asPercent(series1,sumSeries(series1))'));
    });

    it('should replace target placeholder when nesting query references with template variables', () => {
      const originalReplace = ctx.templateSrv.replace;
      ctx.templateSrv.replace = jest
        .fn()
        .mockImplementation(
          (
            target?: string | undefined,
            scopedVars?: ScopedVars | undefined,
            format?: string | Function,
            interpolations?: VariableInterpolation[]
          ): string => {
            if (target?.includes('[[metric]]')) {
              return target.replaceAll('[[metric]]', 'aMetricName');
            }
            return originalReplace(target, scopedVars, format, interpolations);
          }
        );
      const originalTargetMap = {
        A: '[[metric]]',
        B: 'sumSeries(#A)',
        C: 'asPercent(#A,#B)',
      };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [
            { target: '[[metric]]', refId: 'A' },
            { target: 'sumSeries(#A)', refId: 'B' },
            { target: 'asPercent(#A,#B)', refId: 'C' },
          ],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results[2]).toBe('target=' + encodeURIComponent('asPercent(aMetricName,sumSeries(aMetricName))'));
    });

    it('should use scoped variables when nesting query references', () => {
      const originalReplace = ctx.templateSrv.replace;
      ctx.templateSrv.replace = jest
        .fn()
        .mockImplementation(
          (
            target?: string | undefined,
            scopedVars?: ScopedVars | undefined,
            format?: string | Function,
            interpolations?: VariableInterpolation[]
          ): string => {
            if (target?.includes('$metric')) {
              return target.replaceAll('$metric', 'scopedValue');
            }
            return originalReplace(target, scopedVars, format, interpolations);
          }
        );

      const originalTargetMap = {
        A: '$metric',
        B: 'sumSeries(#A)',
      };

      const scopedVars = {
        metric: { text: 'scopedValue', value: 'scopedValue' },
      };

      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [
            { target: '$metric', refId: 'A' },
            { target: 'sumSeries(#A)', refId: 'B' },
          ],
          ...defaultQueryProperties,
        },
        originalTargetMap,
        scopedVars
      );

      expect(results[1]).toBe('target=' + encodeURIComponent('sumSeries(scopedValue)'));
    });

    it('should apply scoped variables to nested references with hidden targets', () => {
      const originalReplace = ctx.templateSrv.replace;
      ctx.templateSrv.replace = jest
        .fn()
        .mockImplementation(
          (
            target?: string | undefined,
            scopedVars?: ScopedVars | undefined,
            format?: string | Function,
            interpolations?: VariableInterpolation[]
          ): string => {
            if (target?.includes('$server')) {
              return target.replaceAll('$server', scopedVars?.server?.value);
            }
            return originalReplace(target, scopedVars, format, interpolations);
          }
        );

      const originalTargetMap = {
        A: '$server.cpu',
        B: 'avg(#A)',
      };

      const scopedVars = {
        server: { text: 'web01', value: 'web01' },
      };

      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [
            { target: '$server.cpu', hide: true, refId: 'A' },
            { target: 'avg(#A)', refId: 'B' },
          ],
          ...defaultQueryProperties,
        },
        originalTargetMap,
        scopedVars
      );

      expect(results[0]).toBe('target=' + encodeURIComponent('avg(web01.cpu)'));
    });

    it('should not recursively replace queries that reference themselves', () => {
      const originalTargetMap = {
        A: 'sumSeries(carbon.test.test-host.cpuUsage, #A)',
      };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [{ target: 'sumSeries(carbon.test.test-host.cpuUsage, #A)', refId: 'A' }],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results[0]).toBe(
        'target=' +
          encodeURIComponent('sumSeries(carbon.test.test-host.cpuUsage, sumSeries(carbon.test.test-host.cpuUsage, #A))')
      );
    });

    it('should not recursively replace queries that reference themselves, but will replace nested references', () => {
      const originalTargetMap = {
        A: 'sumSeries(carbon.test.test-host.cpuUsage, #A, #B)',
        B: 'add(carbon.test.test-host.cpuUsage, 1.5)',
      };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [
            {
              target: 'sumSeries(carbon.test.test-host.cpuUsage, #A, #B)',
              refId: 'A',
            },
            {
              target: 'add(carbon.test.test-host.cpuUsage, 1.5)',
              refId: 'B',
            },
          ],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results[0]).toBe(
        'target=' +
          encodeURIComponent(
            'sumSeries(carbon.test.test-host.cpuUsage, sumSeries(carbon.test.test-host.cpuUsage, #A, #B), add(carbon.test.test-host.cpuUsage, 1.5))'
          )
      );
    });

    it('should fix wrong minute interval parameters', () => {
      const originalTargetMap = {
        A: "summarize(prod.25m.count, '25m', 'sum')",
      };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [{ target: "summarize(prod.25m.count, '25m', 'sum')", refId: 'A' }],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results[0]).toBe('target=' + encodeURIComponent("summarize(prod.25m.count, '25min', 'sum')"));
    });

    it('should fix wrong month interval parameters', () => {
      const originalTargetMap = {
        A: "summarize(prod.5M.count, '5M', 'sum')",
      };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [{ target: "summarize(prod.5M.count, '5M', 'sum')", refId: 'A' }],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results[0]).toBe('target=' + encodeURIComponent("summarize(prod.5M.count, '5mon', 'sum')"));
    });

    it('should ignore empty targets', () => {
      const originalTargetMap = {
        A: 'series1',
        B: '',
      };
      const results = ctx.ds.buildGraphiteParams(
        {
          targets: [
            { target: 'series1', refId: 'A' },
            { target: '', refId: 'B' },
          ],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results.length).toBe(4);
    });

    describe('when formatting targets', () => {
      it('does not attempt to glob for one variable', () => {
        const originalReplace = ctx.templateSrv.replace;
        ctx.templateSrv.replace = jest
          .fn()
          .mockImplementation(
            (
              target?: string | undefined,
              scopedVars?: ScopedVars | undefined,
              format?: string | Function,
              interpolations?: VariableInterpolation[]
            ): string => {
              if (target?.includes('$metric')) {
                return target.replaceAll('$metric', 'b');
              }
              return originalReplace(target, scopedVars, format, interpolations);
            }
          );

        const originalTargetMap = {
          A: 'my.$metric.*',
        };
        const results = ctx.ds.buildGraphiteParams(
          {
            targets: [{ target: 'my.$metric.*', refId: 'A' }],
            ...defaultQueryProperties,
          },
          originalTargetMap
        );
        expect(results).toStrictEqual(['target=my.b.*', 'from=now-1h', 'until=now', 'format=json']);
      });

      it('globs for more than one variable', () => {
        const originalReplace = ctx.templateSrv.replace;
        ctx.templateSrv.replace = jest
          .fn()
          .mockImplementation(
            (
              target?: string | undefined,
              scopedVars?: ScopedVars | undefined,
              format?: string | Function,
              interpolations?: VariableInterpolation[]
            ): string => {
              if (target?.includes('[[metric]]')) {
                return target.replaceAll('[[metric]]', '{a,b}');
              }
              return originalReplace(target, scopedVars, format, interpolations);
            }
          );

        const originalTargetMap = { A: 'my.[[metric]].*' };
        const results = ctx.ds.buildGraphiteParams(
          {
            targets: [{ target: 'my.[[metric]].*', refId: 'A' }],
            ...defaultQueryProperties,
          },
          originalTargetMap
        );

        expect(results).toEqual(['target=my.%7Ba%2Cb%7D.*', 'from=now-1h', 'until=now', 'format=json']);
      });
    });
  });

  describe('building graphite queries (backend)', () => {
    const defaultQueryProperties = {
      requestId: 'reqId',
      interval: '1s',
      intervalMs: 1000,
      maxDataPoints: 100,
      range: {
        from: dateTime('2022-06-06T07:03:03.109Z'),
        to: dateTime('2022-06-07T07:03:03.109Z'),
        raw: {
          from: '2022-06-06T07:03:03.109Z',
          to: '2022-06-07T07:03:03.109Z',
        },
      },
      scopedVars: {},
      timezone: '',
      app: 'dashboards',
      startTime: 0,
    };
    it('should return empty array if no targets', () => {
      const originalTargetMap = { A: '' };
      const results = ctx.ds.backendBuildGraphiteQueries(
        {
          targets: [],
          ...defaultQueryProperties,
        },
        originalTargetMap
      );
      expect(results.length).toBe(0);
    });

    it('should replace target placeholder', () => {
      const originalTargetMap = {
        A: 'series1',
        B: 'series2',
        C: 'asPercent(#A,#B)',
      };
      const results = ctx.ds.backendBuildGraphiteQueries(
        {
          ...defaultQueryProperties,
          targets: [
            { target: 'series1', refId: 'A' },
            { target: 'series2', refId: 'B' },
            { target: 'asPercent(#A,#B)', refId: 'C' },
          ],
        },
        originalTargetMap
      );
      expect(results[2].target).toBe('asPercent(series1,series2)');
    });

    it('should replace target placeholder for hidden series', () => {
      const originalTargetMap = {
        A: 'series1',
        B: 'sumSeries(#A)',
        C: 'asPercent(#A,#B)',
      };
      const results = ctx.ds.backendBuildGraphiteQueries(
        {
          ...defaultQueryProperties,
          targets: [
            { target: 'series1', hide: true, refId: 'A' },
            { target: 'sumSeries(#A)', hide: true, refId: 'B' },
            { target: 'asPercent(#A,#B)', refId: 'C' },
          ],
        },
        originalTargetMap
      );
      expect(results[0].target).toBe('asPercent(series1,sumSeries(series1))');
    });

    it('should replace target placeholder when nesting query references', () => {
      const originalTargetMap = {
        A: 'series1',
        B: 'sumSeries(#A)',
        C: 'asPercent(#A,#B)',
      };
      const results = ctx.ds.backendBuildGraphiteQueries(
        {
          ...defaultQueryProperties,
          targets: [
            { target: 'series1', refId: 'A' },
            { target: 'sumSeries(#A)', refId: 'B' },
            { target: 'asPercent(#A,#B)', refId: 'C' },
          ],
        },
        originalTargetMap
      );
      expect(results[2].target).toBe('asPercent(series1,sumSeries(series1))');
    });

    it('should replace target placeholder when nesting query references with template variables', () => {
      const originalReplace = ctx.templateSrv.replace;
      ctx.templateSrv.replace = jest
        .fn()
        .mockImplementation(
          (
            target?: string | undefined,
            scopedVars?: ScopedVars | undefined,
            format?: string | Function,
            interpolations?: VariableInterpolation[]
          ): string => {
            if (target?.includes('[[metric]]')) {
              return target.replaceAll('[[metric]]', 'aMetricName');
            }
            return originalReplace(target, scopedVars, format, interpolations);
          }
        );
      const originalTargetMap = {
        A: '[[metric]]',
        B: 'sumSeries(#A)',
        C: 'asPercent(#A,#B)',
      };
      const results = ctx.ds.backendBuildGraphiteQueries(
        {
          ...defaultQueryProperties,
          targets: [
            { target: '[[metric]]', refId: 'A' },
            { target: 'sumSeries(#A)', refId: 'B' },
            { target: 'asPercent(#A,#B)', refId: 'C' },
          ],
        },
        originalTargetMap
      );
      expect(results[2].target).toBe('asPercent(aMetricName,sumSeries(aMetricName))');
    });

    it('should use scoped variables when nesting query references', () => {
      const originalReplace = ctx.templateSrv.replace;
      ctx.templateSrv.replace = jest
        .fn()
        .mockImplementation(
          (
            target?: string | undefined,
            scopedVars?: ScopedVars | undefined,
            format?: string | Function,
            interpolations?: VariableInterpolation[]
          ): string => {
            if (target?.includes('$metric')) {
              return target.replaceAll('$metric', 'scopedValue');
            }
            return originalReplace(target, scopedVars, format, interpolations);
          }
        );

      const originalTargetMap = {
        A: '$metric',
        B: 'sumSeries(#A)',
      };

      const scopedVars = {
        metric: { text: 'scopedValue', value: 'scopedValue' },
      };

      const results = ctx.ds.backendBuildGraphiteQueries(
        {
          ...defaultQueryProperties,
          targets: [
            { target: '$metric', refId: 'A' },
            { target: 'sumSeries(#A)', refId: 'B' },
          ],
          scopedVars,
        },
        originalTargetMap
      );

      expect(results[1].target).toBe('sumSeries(scopedValue)');
    });

    it('should apply scoped variables to nested references with hidden targets', () => {
      const originalReplace = ctx.templateSrv.replace;
      ctx.templateSrv.replace = jest
        .fn()
        .mockImplementation(
          (
            target?: string | undefined,
            scopedVars?: ScopedVars | undefined,
            format?: string | Function,
            interpolations?: VariableInterpolation[]
          ): string => {
            if (target?.includes('$server')) {
              return target.replaceAll('$server', scopedVars?.server?.value);
            }
            return originalReplace(target, scopedVars, format, interpolations);
          }
        );

      const originalTargetMap = {
        A: '$server.cpu',
        B: 'avg(#A)',
      };

      const scopedVars = {
        server: { text: 'web01', value: 'web01' },
      };

      const results = ctx.ds.backendBuildGraphiteQueries(
        {
          ...defaultQueryProperties,
          targets: [
            { target: '$server.cpu', hide: true, refId: 'A' },
            { target: 'avg(#A)', refId: 'B' },
          ],
          scopedVars,
        },
        originalTargetMap
      );

      expect(results[0].target).toBe('avg(web01.cpu)');
    });

    it('should not recursively replace queries that reference themselves', () => {
      const originalTargetMap = {
        A: 'sumSeries(carbon.test.test-host.cpuUsage, #A)',
      };
      const results = ctx.ds.backendBuildGraphiteQueries(
        {
          ...defaultQueryProperties,
          targets: [{ target: 'sumSeries(carbon.test.test-host.cpuUsage, #A)', refId: 'A' }],
        },
        originalTargetMap
      );
      expect(results[0].target).toBe(
        'sumSeries(carbon.test.test-host.cpuUsage, sumSeries(carbon.test.test-host.cpuUsage, #A))'
      );
    });

    it('should not recursively replace queries that reference themselves, but will replace nested references', () => {
      const originalTargetMap = {
        A: 'sumSeries(carbon.test.test-host.cpuUsage, #A, #B)',
        B: 'add(carbon.test.test-host.cpuUsage, 1.5)',
      };
      const results = ctx.ds.backendBuildGraphiteQueries(
        {
          ...defaultQueryProperties,
          targets: [
            {
              target: 'sumSeries(carbon.test.test-host.cpuUsage, #A, #B)',
              refId: 'A',
            },
            {
              target: 'add(carbon.test.test-host.cpuUsage, 1.5)',
              refId: 'B',
            },
          ],
        },
        originalTargetMap
      );
      expect(results[0].target).toBe(
        'sumSeries(carbon.test.test-host.cpuUsage, sumSeries(carbon.test.test-host.cpuUsage, #A, #B), add(carbon.test.test-host.cpuUsage, 1.5))'
      );
    });

    it('should ignore empty targets', () => {
      const originalTargetMap = {
        A: 'series1',
        B: '',
      };
      const results = ctx.ds.backendBuildGraphiteQueries(
        {
          ...defaultQueryProperties,
          targets: [
            { target: 'series1', refId: 'A' },
            { target: '', refId: 'B' },
          ],
        },
        originalTargetMap
      );
      expect(results.length).toBe(1);
    });

    describe('when formatting targets', () => {
      it('does not attempt to glob for one variable', () => {
        const originalReplace = ctx.templateSrv.replace;
        ctx.templateSrv.replace = jest
          .fn()
          .mockImplementation(
            (
              target?: string | undefined,
              scopedVars?: ScopedVars | undefined,
              format?: string | Function,
              interpolations?: VariableInterpolation[]
            ): string => {
              if (target?.includes('$metric')) {
                return target.replaceAll('$metric', 'b');
              }
              return originalReplace(target, scopedVars, format, interpolations);
            }
          );

        const originalTargetMap = {
          A: 'my.$metric.*',
        };
        const results = ctx.ds.backendBuildGraphiteQueries(
          { ...defaultQueryProperties, targets: [{ target: 'my.$metric.*', refId: 'A' }] },
          originalTargetMap
        );
        expect(results[0].target).toEqual('my.b.*');
      });

      it('globs for more than one variable', () => {
        const originalReplace = ctx.templateSrv.replace;
        ctx.templateSrv.replace = jest
          .fn()
          .mockImplementation(
            (
              target?: string | undefined,
              scopedVars?: ScopedVars | undefined,
              format?: string | Function,
              interpolations?: VariableInterpolation[]
            ): string => {
              if (target?.includes('[[metric]]')) {
                return target.replaceAll('[[metric]]', '{a,b}');
              }
              return originalReplace(target, scopedVars, format, interpolations);
            }
          );

        const originalTargetMap = { A: 'my.[[metric]].*' };
        const results = ctx.ds.backendBuildGraphiteQueries(
          {
            ...defaultQueryProperties,
            targets: [{ target: 'my.[[metric]].*', refId: 'A' }],
          },
          originalTargetMap
        );

        expect(results[0].target).toEqual('my.{a,b}.*');
      });
    });
  });

  describe('querying for template variables', () => {
    let results: MetricFindValue[];
    let requestOptions: BackendSrvRequest;

    beforeEach(() => {
      fetchMock.mockImplementation((options) => {
        requestOptions = options;
        return of(createFetchResponse(['backend_01', 'backend_02']));
      });
    });

    it('should generate tags query', () => {
      ctx.ds.metricFindQuery('tags()').then((data) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
      expect(requestOptions.params?.expr).toEqual([]);
      expect(results).not.toBe(null);
    });

    it('should generate tags query with a filter expression', () => {
      ctx.ds.metricFindQuery('tags(server=backend_01)').then((data) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
      expect(requestOptions.params?.expr).toEqual(['server=backend_01']);
      expect(results).not.toBe(null);
    });

    it('should generate tags query for an expression with whitespace after', () => {
      ctx.ds.metricFindQuery('tags(server=backend_01 )').then((data) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
      expect(requestOptions.params?.expr).toEqual(['server=backend_01']);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for one tag', () => {
      ctx.ds.metricFindQuery('tag_values(server)').then((data) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params?.tag).toBe('server');
      expect(requestOptions.params?.expr).toEqual([]);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for a tag and expression', () => {
      ctx.ds.metricFindQuery('tag_values(server,server=~backend*)').then((data) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params?.tag).toBe('server');
      expect(requestOptions.params?.expr).toEqual(['server=~backend*']);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for a tag with whitespace after', () => {
      ctx.ds.metricFindQuery('tag_values(server )').then((data) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params?.tag).toBe('server');
      expect(requestOptions.params?.expr).toEqual([]);
      expect(results).not.toBe(null);
    });

    it('should generate tag values query for a tag and expression with whitespace after', () => {
      ctx.ds.metricFindQuery('tag_values(server , server=~backend* )').then((data) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
      expect(requestOptions.params?.tag).toBe('server');
      expect(requestOptions.params?.expr).toEqual(['server=~backend*']);
      expect(results).not.toBe(null);
    });

    it('/metrics/find should be POST', () => {
      const originalReplace = ctx.templateSrv.replace;
      ctx.templateSrv.replace = jest
        .fn()
        .mockImplementation(
          (
            target?: string | undefined,
            scopedVars?: ScopedVars | undefined,
            format?: string | Function,
            interpolations?: VariableInterpolation[]
          ): string => {
            if (target?.includes('[[foo]]')) {
              return target.replaceAll('[[foo]]', 'bar');
            }
            return originalReplace(target, scopedVars, format, interpolations);
          }
        );
      ctx.ds.metricFindQuery('[[foo]]').then((data) => {
        results = data;
      });
      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(requestOptions.method).toEqual('POST');
      expect(requestOptions.headers).toHaveProperty('Content-Type', 'application/x-www-form-urlencoded');
      expect(requestOptions.data).toMatch(`query=bar`);
      expect(requestOptions).toHaveProperty('params');
    });

    it('should interpolate $__searchFilter with searchFilter', () => {
      const originalReplace = ctx.templateSrv.replace;
      ctx.templateSrv.replace = jest
        .fn()
        .mockImplementation(
          (
            target?: string | undefined,
            scopedVars?: ScopedVars | undefined,
            format?: string | Function,
            interpolations?: VariableInterpolation[]
          ): string => {
            if (target?.includes('$__searchFilter')) {
              return target.replaceAll('$__searchFilter', 'backend*');
            }
            return originalReplace(target, scopedVars, format, interpolations);
          }
        );
      ctx.ds.metricFindQuery('app.$__searchFilter', { searchFilter: 'backend' }).then((data) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(requestOptions.params).toEqual({});
      expect(requestOptions.data).toEqual('query=app.backend*');
      expect(results).not.toBe(null);
    });

    it('should interpolate $__searchFilter with default when searchFilter is missing', () => {
      const originalReplace = ctx.templateSrv.replace;
      ctx.templateSrv.replace = jest
        .fn()
        .mockImplementation(
          (
            target?: string | undefined,
            scopedVars?: ScopedVars | undefined,
            format?: string | Function,
            interpolations?: VariableInterpolation[]
          ): string => {
            if (target?.includes('$__searchFilter')) {
              return target.replaceAll('$__searchFilter', '*');
            }
            return originalReplace(target, scopedVars, format, interpolations);
          }
        );
      ctx.ds.metricFindQuery('app.$__searchFilter', {}).then((data) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
      expect(requestOptions.params).toEqual({});
      expect(requestOptions.data).toEqual('query=app.*');
      expect(results).not.toBe(null);
    });

    it('should request expanded metrics', () => {
      ctx.ds.metricFindQuery('expand(*.servers.*)').then((data) => {
        results = data;
      });

      expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/expand');
      expect(requestOptions.params?.query).toBe('*.servers.*');
      expect(results).not.toBe(null);
    });

    it('should fetch from /metrics/find endpoint when queryType is default or query is string', async () => {
      const stringQuery = 'query';
      ctx.ds.metricFindQuery(stringQuery).then((data) => {
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
      fetchMock.mockImplementation((options) => {
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
      fetchMock.mockImplementation((options) => {
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
      fetchMock.mockImplementation((options) => {
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
        render: () => {
          return '';
        },
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

  describe('translateTime', () => {
    it('does not mutate passed in date', async () => {
      const date = new Date('2025-06-30T00:00:59.000Z');
      const functionDate = moment(date);
      const updatedDate = ctx.ds.translateTime(
        dateMath.toDateTime(functionDate.toDate(), { roundUp: undefined, timezone: undefined })!,
        true
      );

      expect(functionDate.toDate()).toEqual(date);
      expect(updatedDate).not.toEqual(date.getTime());
    });
    it('does not mutate passed in relative date - string', async () => {
      const date = 'now-1m';
      const updatedDate = ctx.ds.translateTime(date, true);

      expect(updatedDate).not.toEqual(date);
    });
    it('returns the input if the input is invalid', async () => {
      const updatedDate = ctx.ds.translateTime('', true);

      expect(updatedDate).toBe('');
    });
  });
});

describe('access scenarios', () => {
  describe('access scenario with proxy access', () => {
    const ctx = {
      templateSrv: getTemplateSrv(),
      instanceSettings: { ...instanceSettings, url: 'url', name: 'graphiteProd' },
    };

    const httpOptions: BackendSrvRequest = {
      headers: {},
      url: '/api/datasources/proxy/1',
    };

    describe('when using proxy mode', () => {
      const options = { dashboardUID: '1', panelId: 2 };

      it('tracing headers should be added', () => {
        ctx.instanceSettings.url = '/api/datasources/proxy/1';
        const ds = new GraphiteDatasource(ctx.instanceSettings, ctx.templateSrv);
        ds.addTracingHeaders(httpOptions, options);
        if (!httpOptions.headers) {
          throw new Error('headers not set');
        }
        expect(httpOptions.headers['X-Dashboard-Id']).toBe('1');
        expect(httpOptions.headers['X-Panel-Id']).toBe(2);
      });
    });
  });

  describe('access scenario with direct access', () => {
    const ctx = {
      templateSrv: getTemplateSrv(),
      instanceSettings: { ...instanceSettings, url: 'url', name: 'graphiteProd' },
    };

    const httpOptions: BackendSrvRequest = {
      headers: {},
      url: 'http://localhost:8080',
    };

    describe('when using proxy mode', () => {
      const options = { dashboardUid: '1', panelId: 2 };

      it('tracing headers should be added', () => {
        ctx.instanceSettings.url = 'http://localhost:8080';
        const ds = new GraphiteDatasource(ctx.instanceSettings, ctx.templateSrv);
        ds.addTracingHeaders(httpOptions, options);
        if (!httpOptions.headers) {
          throw new Error('headers not set');
        }
        expect(httpOptions.headers['X-Dashboard-Id']).toBe(undefined);
        expect(httpOptions.headers['X-Panel-Id']).toBe(undefined);
      });
    });
  });
});

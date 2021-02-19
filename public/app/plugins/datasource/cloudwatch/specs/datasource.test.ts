import '../datasource';
import CloudWatchDatasource from '../datasource';
import * as redux from 'app/store/store';
import { dateMath } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CustomVariable } from 'app/features/templating/all';
import _ from 'lodash';
import { CloudWatchQuery } from '../types';
import { DataSourceInstanceSettings } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

describe('CloudWatchDatasource', () => {
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  const instanceSettings = {
    jsonData: { defaultRegion: 'us-east-1' },
    name: 'TestDatasource',
  } as DataSourceInstanceSettings;

  const templateSrv = new TemplateSrv();
  const start = 1483196400 * 1000;
  const defaultTimeRange = { from: new Date(start), to: new Date(start + 3600 * 1000) };

  const timeSrv = {
    time: { from: 'now-1h', to: 'now' },
    timeRange: () => {
      return {
        from: dateMath.parse(timeSrv.time.from, false),
        to: dateMath.parse(timeSrv.time.to, true),
      };
    },
  } as TimeSrv;

  const ctx = {
    templateSrv,
  } as any;

  beforeEach(() => {
    ctx.ds = new CloudWatchDatasource(instanceSettings, templateSrv, timeSrv);
    jest.clearAllMocks();
  });

  describe('When performing CloudWatch query', () => {
    let requestParams: { queries: CloudWatchQuery[] };

    const query = {
      range: defaultTimeRange,
      rangeRaw: { from: 1483228800, to: 1483232400 },
      targets: [
        {
          expression: '',
          refId: 'A',
          region: 'us-east-1',
          namespace: 'AWS/EC2',
          metricName: 'CPUUtilization',
          dimensions: {
            InstanceId: 'i-12345678',
          },
          statistics: ['Average'],
          period: '300',
        },
      ],
    };

    const response: any = {
      timings: [null],
      results: {
        A: {
          error: '',
          refId: 'A',
          meta: { gmdMeta: [] },
          series: [
            {
              name: 'CPUUtilization_Average',
              points: [
                [1, 1483228800000],
                [2, 1483229100000],
                [5, 1483229700000],
              ],
              tags: {
                InstanceId: 'i-12345678',
              },
            },
          ],
        },
      },
    };

    beforeEach(() => {
      datasourceRequestMock.mockImplementation(params => {
        requestParams = params.data;
        return Promise.resolve({ data: response });
      });
    });

    it('should generate the correct query', done => {
      ctx.ds.query(query).then(() => {
        const params = requestParams.queries[0];
        expect(params.namespace).toBe(query.targets[0].namespace);
        expect(params.metricName).toBe(query.targets[0].metricName);
        expect(params.dimensions['InstanceId']).toStrictEqual(['i-12345678']);
        expect(params.statistics).toEqual(query.targets[0].statistics);
        expect(params.period).toBe(query.targets[0].period);
        done();
      });
    });

    it('should generate the correct query with interval variable', done => {
      templateSrv.init([
        new CustomVariable(
          {
            name: 'period',
            current: {
              value: '10m',
            },
            multi: false,
          },
          {} as any
        ),
      ]);

      const query = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            refId: 'A',
            region: 'us-east-1',
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            dimensions: {
              InstanceId: 'i-12345678',
            },
            statistics: ['Average'],
            period: '[[period]]',
          },
        ],
      };

      ctx.ds.query(query).then(() => {
        const params = requestParams.queries[0];
        expect(params.period).toBe('600');
        done();
      });
    });

    it.each(['pNN.NN', 'p9', 'p99.', 'p99.999'])('should cancel query for invalid extended statistics (%s)', stat => {
      const query = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            refId: 'A',
            region: 'us-east-1',
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            dimensions: {
              InstanceId: 'i-12345678',
            },
            statistics: [stat],
            period: '60s',
          },
        ],
      };
      expect(ctx.ds.query.bind(ctx.ds, query)).toThrow(/Invalid extended statistics/);
    });

    it('should return series list', done => {
      ctx.ds.query(query).then((result: any) => {
        expect(result.data[0].name).toBe(response.results.A.series[0].name);
        expect(result.data[0].fields[0].values.buffer[0]).toBe(response.results.A.series[0].points[0][0]);
        done();
      });
    });

    describe('a correct cloudwatch url should be built for each time series in the response', () => {
      beforeEach(() => {
        datasourceRequestMock.mockImplementation(params => {
          requestParams = params.data;
          return Promise.resolve({ data: response });
        });
      });

      it('should be built correctly if theres one search expressions returned in meta for a given query row', done => {
        response.results['A'].meta.gmdMeta = [{ Expression: `REMOVE_EMPTY(SEARCH('some expression'))`, Period: '300' }];
        ctx.ds.query(query).then((result: any) => {
          expect(result.data[0].name).toBe(response.results.A.series[0].name);
          expect(result.data[0].fields[0].config.links[0].title).toBe('View in CloudWatch console');
          expect(decodeURIComponent(result.data[0].fields[0].config.links[0].url)).toContain(
            `region=us-east-1#metricsV2:graph={"view":"timeSeries","stacked":false,"title":"A","start":"2016-12-31T15:00:00.000Z","end":"2016-12-31T16:00:00.000Z","region":"us-east-1","metrics":[{"expression":"REMOVE_EMPTY(SEARCH(\'some expression\'))"}]}`
          );
          done();
        });
      });

      it('should be built correctly if theres two search expressions returned in meta for a given query row', done => {
        response.results['A'].meta.gmdMeta = [
          { Expression: `REMOVE_EMPTY(SEARCH('first expression'))` },
          { Expression: `REMOVE_EMPTY(SEARCH('second expression'))` },
        ];
        ctx.ds.query(query).then((result: any) => {
          expect(result.data[0].name).toBe(response.results.A.series[0].name);
          expect(result.data[0].fields[0].config.links[0].title).toBe('View in CloudWatch console');
          expect(decodeURIComponent(result.data[0].fields[0].config.links[0].url)).toContain(
            `region=us-east-1#metricsV2:graph={"view":"timeSeries","stacked":false,"title":"A","start":"2016-12-31T15:00:00.000Z","end":"2016-12-31T16:00:00.000Z","region":"us-east-1","metrics":[{"expression":"REMOVE_EMPTY(SEARCH(\'first expression\'))"},{"expression":"REMOVE_EMPTY(SEARCH(\'second expression\'))"}]}`
          );
          done();
        });
      });

      it('should be built correctly if the query is a metric stat query', done => {
        response.results['A'].meta.gmdMeta = [{ Period: '300' }];
        ctx.ds.query(query).then((result: any) => {
          expect(result.data[0].name).toBe(response.results.A.series[0].name);
          expect(result.data[0].fields[0].config.links[0].title).toBe('View in CloudWatch console');
          expect(decodeURIComponent(result.data[0].fields[0].config.links[0].url)).toContain(
            `region=us-east-1#metricsV2:graph={\"view\":\"timeSeries\",\"stacked\":false,\"title\":\"A\",\"start\":\"2016-12-31T15:00:00.000Z\",\"end\":\"2016-12-31T16:00:00.000Z\",\"region\":\"us-east-1\",\"metrics\":[[\"AWS/EC2\",\"CPUUtilization\",\"InstanceId\",\"i-12345678\",{\"stat\":\"Average\",\"period\":\"300\"}]]}`
          );
          done();
        });
      });

      it('should not be added at all if query is a math expression', done => {
        query.targets[0].expression = 'a * 2';
        response.results['A'].meta.searchExpressions = [];
        ctx.ds.query(query).then((result: any) => {
          expect(result.data[0].fields[0].config.links).toBeUndefined();
          done();
        });
      });
    });

    describe('and throttling exception is thrown', () => {
      const partialQuery = {
        namespace: 'AWS/EC2',
        metricName: 'CPUUtilization',
        dimensions: {
          InstanceId: 'i-12345678',
        },
        statistics: ['Average'],
        period: '300',
        expression: '',
      };

      const query = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          { ...partialQuery, refId: 'A', region: 'us-east-1' },
          { ...partialQuery, refId: 'B', region: 'us-east-2' },
          { ...partialQuery, refId: 'C', region: 'us-east-1' },
          { ...partialQuery, refId: 'D', region: 'us-east-2' },
          { ...partialQuery, refId: 'E', region: 'eu-north-1' },
        ],
      };

      const backendErrorResponse = {
        data: {
          message: 'Throttling: exception',
          results: {
            A: {
              error: 'Throttling: exception',
              refId: 'A',
              meta: {},
            },
            B: {
              error: 'Throttling: exception',
              refId: 'B',
              meta: {},
            },
            C: {
              error: 'Throttling: exception',
              refId: 'C',
              meta: {},
            },
            D: {
              error: 'Throttling: exception',
              refId: 'D',
              meta: {},
            },
            E: {
              error: 'Throttling: exception',
              refId: 'E',
              meta: {},
            },
          },
        },
      };

      beforeEach(() => {
        redux.setStore({
          dispatch: jest.fn(),
        } as any);

        datasourceRequestMock.mockImplementation(() => {
          return Promise.reject(backendErrorResponse);
        });
      });

      it('should display one alert error message per region+datasource combination', done => {
        const memoizedDebounceSpy = jest.spyOn(ctx.ds, 'debouncedAlert');
        ctx.ds.query(query).catch(() => {
          expect(memoizedDebounceSpy).toHaveBeenCalledWith('TestDatasource', 'us-east-1');
          expect(memoizedDebounceSpy).toHaveBeenCalledWith('TestDatasource', 'us-east-2');
          expect(memoizedDebounceSpy).toHaveBeenCalledWith('TestDatasource', 'eu-north-1');
          expect(memoizedDebounceSpy).toBeCalledTimes(3);
          done();
        });
      });
    });

    describe('when regions query is used', () => {
      beforeEach(() => {
        datasourceRequestMock.mockImplementation(() => {
          return Promise.resolve({});
        });
        ctx.ds = new CloudWatchDatasource(instanceSettings, templateSrv, timeSrv);
        ctx.ds.doMetricQueryRequest = jest.fn(() => []);
      });
      describe('and region param is left out', () => {
        it('should use the default region', done => {
          ctx.ds.metricFindQuery('metrics(testNamespace)').then(() => {
            expect(ctx.ds.doMetricQueryRequest).toHaveBeenCalledWith('metrics', {
              namespace: 'testNamespace',
              region: instanceSettings.jsonData.defaultRegion,
            });
            done();
          });
        });
      });

      describe('and region param is defined by user', () => {
        it('should use the user defined region', done => {
          ctx.ds.metricFindQuery('metrics(testNamespace2, custom-region)').then(() => {
            expect(ctx.ds.doMetricQueryRequest).toHaveBeenCalledWith('metrics', {
              namespace: 'testNamespace2',
              region: 'custom-region',
            });
            done();
          });
        });
      });
    });
  });

  describe('When query region is "default"', () => {
    it('should return the datasource region if empty or "default"', () => {
      const defaultRegion = instanceSettings.jsonData.defaultRegion;

      expect(ctx.ds.getActualRegion()).toBe(defaultRegion);
      expect(ctx.ds.getActualRegion('')).toBe(defaultRegion);
      expect(ctx.ds.getActualRegion('default')).toBe(defaultRegion);
    });

    it('should return the specified region if specified', () => {
      expect(ctx.ds.getActualRegion('some-fake-region-1')).toBe('some-fake-region-1');
    });

    let requestParams: { queries: CloudWatchQuery[] };
    beforeEach(() => {
      ctx.ds.performTimeSeriesQuery = jest.fn(request => {
        requestParams = request;
        return Promise.resolve({ data: {} });
      });
    });

    it('should query for the datasource region if empty or "default"', done => {
      const query = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            refId: 'A',
            region: 'default',
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            dimensions: {
              InstanceId: 'i-12345678',
            },
            statistics: ['Average'],
            period: '300s',
          },
        ],
      };

      ctx.ds.query(query).then((result: any) => {
        expect(requestParams.queries[0].region).toBe(instanceSettings.jsonData.defaultRegion);
        done();
      });
    });
  });

  describe('When performing CloudWatch query for extended statistics', () => {
    const query = {
      range: defaultTimeRange,
      rangeRaw: { from: 1483228800, to: 1483232400 },
      targets: [
        {
          refId: 'A',
          region: 'us-east-1',
          namespace: 'AWS/ApplicationELB',
          metricName: 'TargetResponseTime',
          dimensions: {
            LoadBalancer: 'lb',
            TargetGroup: 'tg',
          },
          statistics: ['p90.00'],
          period: '300s',
        },
      ],
    };

    const response: any = {
      timings: [null],
      results: {
        A: {
          error: '',
          refId: 'A',
          meta: {
            gmdMeta: [
              {
                Period: 300,
              },
            ],
          },
          series: [
            {
              name: 'TargetResponseTime_p90.00',
              points: [
                [1, 1483228800000],
                [2, 1483229100000],
                [5, 1483229700000],
              ],
              tags: {
                LoadBalancer: 'lb',
                TargetGroup: 'tg',
              },
            },
          ],
        },
      },
    };

    beforeEach(() => {
      datasourceRequestMock.mockImplementation(params => {
        return Promise.resolve({ data: response });
      });
    });

    it('should return series list', done => {
      ctx.ds.query(query).then((result: any) => {
        expect(result.data[0].name).toBe(response.results.A.series[0].name);
        expect(result.data[0].fields[0].values.buffer[0]).toBe(response.results.A.series[0].points[0][0]);
        done();
      });
    });
  });

  describe('When performing CloudWatch query with template variables', () => {
    let requestParams: { queries: CloudWatchQuery[] };
    beforeEach(() => {
      templateSrv.init([
        new CustomVariable(
          {
            name: 'var1',
            current: {
              value: 'var1-foo',
            },
            multi: false,
          },
          {} as any
        ),
        new CustomVariable(
          {
            name: 'var2',
            current: {
              value: 'var2-foo',
            },
            multi: false,
          },
          {} as any
        ),
        new CustomVariable(
          {
            name: 'var3',
            options: [
              { selected: true, value: 'var3-foo' },
              { selected: false, value: 'var3-bar' },
              { selected: true, value: 'var3-baz' },
            ],
            current: {
              value: ['var3-foo', 'var3-baz'],
            },
            multi: true,
          },
          {} as any
        ),
        new CustomVariable(
          {
            name: 'var4',
            options: [
              { selected: true, value: 'var4-foo' },
              { selected: false, value: 'var4-bar' },
              { selected: true, value: 'var4-baz' },
            ],
            current: {
              value: ['var4-foo', 'var4-baz'],
            },
            multi: true,
          },
          {} as any
        ),
      ]);

      datasourceRequestMock.mockImplementation(params => {
        requestParams = params.data;
        return Promise.resolve({ data: {} });
      });
    });

    it('should generate the correct query for single template variable', done => {
      const query = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            refId: 'A',
            region: 'us-east-1',
            namespace: 'TestNamespace',
            metricName: 'TestMetricName',
            dimensions: {
              dim2: '[[var2]]',
            },
            statistics: ['Average'],
            period: '300s',
          },
        ],
      };

      ctx.ds.query(query).then(() => {
        expect(requestParams.queries[0].dimensions['dim2']).toStrictEqual(['var2-foo']);
        done();
      });
    });

    it('should generate the correct query in the case of one multilple template variables', done => {
      const query = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            refId: 'A',
            region: 'us-east-1',
            namespace: 'TestNamespace',
            metricName: 'TestMetricName',
            dimensions: {
              dim1: '[[var1]]',
              dim2: '[[var2]]',
              dim3: '[[var3]]',
            },
            statistics: ['Average'],
            period: '300s',
          },
        ],
        scopedVars: {
          var1: { selected: true, value: 'var1-foo' },
          var2: { selected: true, value: 'var2-foo' },
        },
      };

      ctx.ds.query(query).then(() => {
        expect(requestParams.queries[0].dimensions['dim1']).toStrictEqual(['var1-foo']);
        expect(requestParams.queries[0].dimensions['dim2']).toStrictEqual(['var2-foo']);
        expect(requestParams.queries[0].dimensions['dim3']).toStrictEqual(['var3-foo', 'var3-baz']);
        done();
      });
    });

    it('should generate the correct query in the case of multilple multi template variables', done => {
      const query = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            refId: 'A',
            region: 'us-east-1',
            namespace: 'TestNamespace',
            metricName: 'TestMetricName',
            dimensions: {
              dim1: '[[var1]]',
              dim3: '[[var3]]',
              dim4: '[[var4]]',
            },
            statistics: ['Average'],
            period: '300s',
          },
        ],
      };

      ctx.ds.query(query).then(() => {
        expect(requestParams.queries[0].dimensions['dim1']).toStrictEqual(['var1-foo']);
        expect(requestParams.queries[0].dimensions['dim3']).toStrictEqual(['var3-foo', 'var3-baz']);
        expect(requestParams.queries[0].dimensions['dim4']).toStrictEqual(['var4-foo', 'var4-baz']);
        done();
      });
    });

    it('should generate the correct query for multilple template variables, lack scopedVars', done => {
      const query = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            refId: 'A',
            region: 'us-east-1',
            namespace: 'TestNamespace',
            metricName: 'TestMetricName',
            dimensions: {
              dim1: '[[var1]]',
              dim2: '[[var2]]',
              dim3: '[[var3]]',
            },
            statistics: ['Average'],
            period: '300',
          },
        ],
        scopedVars: {
          var1: { selected: true, value: 'var1-foo' },
        },
      };

      ctx.ds.query(query).then(() => {
        expect(requestParams.queries[0].dimensions['dim1']).toStrictEqual(['var1-foo']);
        expect(requestParams.queries[0].dimensions['dim2']).toStrictEqual(['var2-foo']);
        expect(requestParams.queries[0].dimensions['dim3']).toStrictEqual(['var3-foo', 'var3-baz']);
        done();
      });
    });
  });

  function describeMetricFindQuery(query: any, func: any) {
    describe('metricFindQuery ' + query, () => {
      const scenario: any = {};
      scenario.setup = async (setupCallback: any) => {
        beforeEach(async () => {
          await setupCallback();
          datasourceRequestMock.mockImplementation(args => {
            scenario.request = args.data;
            return Promise.resolve({ data: scenario.requestResponse });
          });
          ctx.ds.metricFindQuery(query).then((args: any) => {
            scenario.result = args;
          });
        });
      };

      func(scenario);
    });
  }

  describeMetricFindQuery('regions()', async (scenario: any) => {
    await scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['us-east-1', 'us-east-1']] }],
          },
        },
      };
    });

    it('should call __GetRegions and return result', () => {
      expect(scenario.result[0].text).toContain('us-east-1');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('regions');
    });
  });

  describeMetricFindQuery('namespaces()', async (scenario: any) => {
    await scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['AWS/EC2', 'AWS/EC2']] }],
          },
        },
      };
    });

    it('should call __GetNamespaces and return result', () => {
      expect(scenario.result[0].text).toContain('AWS/EC2');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('namespaces');
    });
  });

  describeMetricFindQuery('metrics(AWS/EC2, us-east-2)', async (scenario: any) => {
    await scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['CPUUtilization', 'CPUUtilization']] }],
          },
        },
      };
    });

    it('should call __GetMetrics and return result', () => {
      expect(scenario.result[0].text).toBe('CPUUtilization');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('metrics');
    });
  });

  describeMetricFindQuery('dimension_keys(AWS/EC2)', async (scenario: any) => {
    await scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['InstanceId', 'InstanceId']] }],
          },
        },
      };
    });

    it('should call __GetDimensions and return result', () => {
      console.log({ a: scenario.requestResponse.results });
      expect(scenario.result[0].text).toBe('InstanceId');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('dimension_keys');
    });
  });

  describeMetricFindQuery('dimension_values(us-east-1,AWS/EC2,CPUUtilization,InstanceId)', async (scenario: any) => {
    await scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['i-12345678', 'i-12345678']] }],
          },
        },
      };
    });

    it('should call __ListMetrics and return result', () => {
      expect(scenario.result[0].text).toContain('i-12345678');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('dimension_values');
    });
  });

  describeMetricFindQuery('dimension_values(default,AWS/EC2,CPUUtilization,InstanceId)', async (scenario: any) => {
    await scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['i-12345678', 'i-12345678']] }],
          },
        },
      };
    });

    it('should call __ListMetrics and return result', () => {
      expect(scenario.result[0].text).toContain('i-12345678');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('dimension_values');
    });
  });

  describeMetricFindQuery(
    'resource_arns(default,ec2:instance,{"environment":["production"]})',
    async (scenario: any) => {
      await scenario.setup(() => {
        scenario.requestResponse = {
          results: {
            metricFindQuery: {
              tables: [
                {
                  rows: [
                    [
                      'arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567',
                      'arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321',
                    ],
                  ],
                },
              ],
            },
          },
        };
      });

      it('should call __ListMetrics and return result', () => {
        expect(scenario.result[0].text).toContain('arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567');
        expect(scenario.request.queries[0].type).toBe('metricFindQuery');
        expect(scenario.request.queries[0].subtype).toBe('resource_arns');
      });
    }
  );
});

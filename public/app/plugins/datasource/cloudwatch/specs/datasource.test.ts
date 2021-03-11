import { interval, of, throwError } from 'rxjs';
import {
  DataFrame,
  DataQueryErrorType,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateMath,
  getFrameDisplayName,
} from '@grafana/data';

import * as redux from 'app/store/store';
import { CloudWatchDatasource, MAX_ATTEMPTS } from '../datasource';
import { TemplateSrv } from 'app/features/templating/template_srv';
import {
  CloudWatchJsonData,
  CloudWatchLogsQuery,
  CloudWatchLogsQueryStatus,
  CloudWatchMetricsQuery,
  LogAction,
} from '../types';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { convertToStoreState } from '../../../../../test/helpers/convertToStoreState';
import { getTemplateSrvDependencies } from 'test/helpers/getTemplateSrvDependencies';
import { CustomVariableModel, initialVariableModelState, VariableHide } from '../../../../features/variables/types';

import * as rxjsUtils from '../utils/rxjs/increasingInterval';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

jest.mock('rxjs/operators', () => {
  const operators = jest.requireActual('rxjs/operators');
  operators.delay = jest.fn(() => (s: any) => s);
  return operators;
});

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

type Args = { response?: any; throws?: boolean; templateSrv?: TemplateSrv };

function getTestContext({ response = {}, throws = false, templateSrv = new TemplateSrv() }: Args = {}) {
  jest.clearAllMocks();

  const fetchMock = jest.spyOn(backendSrv, 'fetch');

  throws
    ? fetchMock.mockImplementation(() => throwError(response))
    : fetchMock.mockImplementation(() => of(createFetchResponse(response)));

  const instanceSettings = {
    jsonData: { defaultRegion: 'us-east-1' },
    name: 'TestDatasource',
  } as DataSourceInstanceSettings<CloudWatchJsonData>;

  const timeSrv = {
    time: { from: '2016-12-31 15:00:00Z', to: '2016-12-31 16:00:00Z' },
    timeRange: () => {
      return {
        from: dateMath.parse(timeSrv.time.from, false),
        to: dateMath.parse(timeSrv.time.to, true),
      };
    },
  } as TimeSrv;

  const ds = new CloudWatchDatasource(instanceSettings, templateSrv, timeSrv);

  return { ds, fetchMock, instanceSettings };
}

describe('CloudWatchDatasource', () => {
  const start = 1483196400 * 1000;
  const defaultTimeRange = { from: new Date(start), to: new Date(start + 3600 * 1000) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('When getting log groups', () => {
    it('should return log groups as an array of strings', async () => {
      const response = {
        results: {
          A: {
            dataframes: [
              'QVJST1cxAAD/////GAEAABAAAAAAAAoADgAMAAsABAAKAAAAFAAAAAAAAAEDAAoADAAAAAgABAAKAAAACAAAAFgAAAACAAAAKAAAAAQAAAB8////CAAAAAwAAAAAAAAAAAAAAAUAAAByZWZJZAAAAJz///8IAAAAFAAAAAkAAABsb2dHcm91cHMAAAAEAAAAbmFtZQAAAAABAAAAGAAAAAAAEgAYABQAEwASAAwAAAAIAAQAEgAAABQAAABMAAAAUAAAAAAABQFMAAAAAQAAAAwAAAAIAAwACAAEAAgAAAAIAAAAGAAAAAwAAABsb2dHcm91cE5hbWUAAAAABAAAAG5hbWUAAAAAAAAAAAQABAAEAAAADAAAAGxvZ0dyb3VwTmFtZQAAAAD/////mAAAABQAAAAAAAAADAAWABQAEwAMAAQADAAAAGAGAAAAAAAAFAAAAAAAAAMDAAoAGAAMAAgABAAKAAAAFAAAAEgAAAAhAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiAAAAAAAAACIAAAAAAAAANgFAAAAAAAAAAAAAAEAAAAhAAAAAAAAAAAAAAAAAAAAAAAAADIAAABiAAAAkQAAALwAAADuAAAAHwEAAFQBAACHAQAAtQEAAOoBAAAbAgAASgIAAHQCAAClAgAA1QIAABADAABEAwAAdgMAAKMDAADXAwAACQQAAEAEAAB3BAAAlwQAAK0EAAC8BAAA+wQAAEIFAABhBQAAeAUAAJIFAAC0BQAA1gUAAC9hd3MvY29udGFpbmVyaW5zaWdodHMvZGV2MzAzLXdvcmtzaG9wL2FwcGxpY2F0aW9uL2F3cy9jb250YWluZXJpbnNpZ2h0cy9kZXYzMDMtd29ya3Nob3AvZGF0YXBsYW5lL2F3cy9jb250YWluZXJpbnNpZ2h0cy9kZXYzMDMtd29ya3Nob3AvZmxvd2xvZ3MvYXdzL2NvbnRhaW5lcmluc2lnaHRzL2RldjMwMy13b3Jrc2hvcC9ob3N0L2F3cy9jb250YWluZXJpbnNpZ2h0cy9kZXYzMDMtd29ya3Nob3AvcGVyZm9ybWFuY2UvYXdzL2NvbnRhaW5lcmluc2lnaHRzL2RldjMwMy13b3Jrc2hvcC9wcm9tZXRoZXVzL2F3cy9jb250YWluZXJpbnNpZ2h0cy9lY29tbWVyY2Utc29ja3Nob3AvYXBwbGljYXRpb24vYXdzL2NvbnRhaW5lcmluc2lnaHRzL2Vjb21tZXJjZS1zb2Nrc2hvcC9kYXRhcGxhbmUvYXdzL2NvbnRhaW5lcmluc2lnaHRzL2Vjb21tZXJjZS1zb2Nrc2hvcC9ob3N0L2F3cy9jb250YWluZXJpbnNpZ2h0cy9lY29tbWVyY2Utc29ja3Nob3AvcGVyZm9ybWFuY2UvYXdzL2NvbnRhaW5lcmluc2lnaHRzL3dhdGNoZGVtby1wZXJmL2FwcGxpY2F0aW9uL2F3cy9jb250YWluZXJpbnNpZ2h0cy93YXRjaGRlbW8tcGVyZi9kYXRhcGxhbmUvYXdzL2NvbnRhaW5lcmluc2lnaHRzL3dhdGNoZGVtby1wZXJmL2hvc3QvYXdzL2NvbnRhaW5lcmluc2lnaHRzL3dhdGNoZGVtby1wZXJmL3BlcmZvcm1hbmNlL2F3cy9jb250YWluZXJpbnNpZ2h0cy93YXRjaGRlbW8tcGVyZi9wcm9tZXRoZXVzL2F3cy9jb250YWluZXJpbnNpZ2h0cy93YXRjaGRlbW8tcHJvZC11cy1lYXN0LTEvcGVyZm9ybWFuY2UvYXdzL2NvbnRhaW5lcmluc2lnaHRzL3dhdGNoZGVtby1zdGFnaW5nL2FwcGxpY2F0aW9uL2F3cy9jb250YWluZXJpbnNpZ2h0cy93YXRjaGRlbW8tc3RhZ2luZy9kYXRhcGxhbmUvYXdzL2NvbnRhaW5lcmluc2lnaHRzL3dhdGNoZGVtby1zdGFnaW5nL2hvc3QvYXdzL2NvbnRhaW5lcmluc2lnaHRzL3dhdGNoZGVtby1zdGFnaW5nL3BlcmZvcm1hbmNlL2F3cy9lY3MvY29udGFpbmVyaW5zaWdodHMvYnVnYmFzaC1lYzIvcGVyZm9ybWFuY2UvYXdzL2Vjcy9jb250YWluZXJpbnNpZ2h0cy9lY3MtZGVtb3dvcmtzaG9wL3BlcmZvcm1hbmNlL2F3cy9lY3MvY29udGFpbmVyaW5zaWdodHMvZWNzLXdvcmtzaG9wLWRldi9wZXJmb3JtYW5jZS9hd3MvZWtzL2RldjMwMy13b3Jrc2hvcC9jbHVzdGVyL2F3cy9ldmVudHMvY2xvdWR0cmFpbC9hd3MvZXZlbnRzL2Vjcy9hd3MvbGFtYmRhL2N3c3luLW15Y2FuYXJ5LWZhYzk3ZGVkLWYxMzQtNDk5YS05ZDcxLTRjM2JlMWY2MzE4Mi9hd3MvbGFtYmRhL2N3c3luLXdhdGNoLWxpbmtjaGVja3MtZWY3ZWYyNzMtNWRhMi00NjYzLWFmNTQtZDJmNTJkNTViMDYwL2Vjcy9lY3MtY3dhZ2VudC1kYWVtb24tc2VydmljZS9lY3MvZWNzLWRlbW8tbGltaXRUYXNrQ2xvdWRUcmFpbC9EZWZhdWx0TG9nR3JvdXBjb250YWluZXItaW5zaWdodHMtcHJvbWV0aGV1cy1iZXRhY29udGFpbmVyLWluc2lnaHRzLXByb21ldGhldXMtZGVtbwAAEAAAAAwAFAASAAwACAAEAAwAAAAQAAAALAAAADwAAAAAAAMAAQAAACgBAAAAAAAAoAAAAAAAAABgBgAAAAAAAAAAAAAAAAAAAAAAAAAACgAMAAAACAAEAAoAAAAIAAAAWAAAAAIAAAAoAAAABAAAAHz///8IAAAADAAAAAAAAAAAAAAABQAAAHJlZklkAAAAnP///wgAAAAUAAAACQAAAGxvZ0dyb3VwcwAAAAQAAABuYW1lAAAAAAEAAAAYAAAAAAASABgAFAATABIADAAAAAgABAASAAAAFAAAAEwAAABQAAAAAAAFAUwAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAYAAAADAAAAGxvZ0dyb3VwTmFtZQAAAAAEAAAAbmFtZQAAAAAAAAAABAAEAAQAAAAMAAAAbG9nR3JvdXBOYW1lAAAAAEgBAABBUlJPVzE=',
            ],
            refId: 'A',
          },
        },
      };
      const { ds } = getTestContext({ response });
      const expectedLogGroups = [
        '/aws/containerinsights/dev303-workshop/application',
        '/aws/containerinsights/dev303-workshop/dataplane',
        '/aws/containerinsights/dev303-workshop/flowlogs',
        '/aws/containerinsights/dev303-workshop/host',
        '/aws/containerinsights/dev303-workshop/performance',
        '/aws/containerinsights/dev303-workshop/prometheus',
        '/aws/containerinsights/ecommerce-sockshop/application',
        '/aws/containerinsights/ecommerce-sockshop/dataplane',
        '/aws/containerinsights/ecommerce-sockshop/host',
        '/aws/containerinsights/ecommerce-sockshop/performance',
        '/aws/containerinsights/watchdemo-perf/application',
        '/aws/containerinsights/watchdemo-perf/dataplane',
        '/aws/containerinsights/watchdemo-perf/host',
        '/aws/containerinsights/watchdemo-perf/performance',
        '/aws/containerinsights/watchdemo-perf/prometheus',
        '/aws/containerinsights/watchdemo-prod-us-east-1/performance',
        '/aws/containerinsights/watchdemo-staging/application',
        '/aws/containerinsights/watchdemo-staging/dataplane',
        '/aws/containerinsights/watchdemo-staging/host',
        '/aws/containerinsights/watchdemo-staging/performance',
        '/aws/ecs/containerinsights/bugbash-ec2/performance',
        '/aws/ecs/containerinsights/ecs-demoworkshop/performance',
        '/aws/ecs/containerinsights/ecs-workshop-dev/performance',
        '/aws/eks/dev303-workshop/cluster',
        '/aws/events/cloudtrail',
        '/aws/events/ecs',
        '/aws/lambda/cwsyn-mycanary-fac97ded-f134-499a-9d71-4c3be1f63182',
        '/aws/lambda/cwsyn-watch-linkchecks-ef7ef273-5da2-4663-af54-d2f52d55b060',
        '/ecs/ecs-cwagent-daemon-service',
        '/ecs/ecs-demo-limitTask',
        'CloudTrail/DefaultLogGroup',
        'container-insights-prometheus-beta',
        'container-insights-prometheus-demo',
      ];

      const logGroups = await ds.describeLogGroups({});

      expect(logGroups).toEqual(expectedLogGroups);
    });
  });

  describe('When performing CloudWatch logs query', () => {
    beforeEach(() => {
      jest.spyOn(rxjsUtils, 'increasingInterval').mockImplementation(() => interval(100));
    });

    it('should add data links to response', () => {
      const { ds } = getTestContext();
      const mockResponse: DataQueryResponse = {
        data: [
          {
            fields: [
              {
                config: {
                  links: [],
                },
              },
            ],
            refId: 'A',
          },
        ],
      };

      const mockOptions: any = {
        targets: [
          {
            refId: 'A',
            expression: 'stats count(@message) by bin(1h)',
            logGroupNames: ['fake-log-group-one', 'fake-log-group-two'],
            region: 'default',
          },
        ],
      };

      const saturatedResponse = ds['addDataLinksToLogsResponse'](mockResponse, mockOptions);
      expect(saturatedResponse).toMatchObject({
        data: [
          {
            fields: [
              {
                config: {
                  links: [
                    {
                      url:
                        "https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logs-insights:queryDetail=~(end~'2016-12-31T16*3a00*3a00.000Z~start~'2016-12-31T15*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'stats*20count*28*40message*29*20by*20bin*281h*29~isLiveTail~false~source~(~'fake-log-group-one~'fake-log-group-two))",
                      title: 'View in CloudWatch console',
                      targetBlank: true,
                    },
                  ],
                },
              },
            ],
            refId: 'A',
          },
        ],
      });
    });

    it('should stop querying when no more data received a number of times in a row', async () => {
      const { ds } = getTestContext();
      const fakeFrames = genMockFrames(20);
      const initialRecordsMatched = fakeFrames[0].meta!.stats!.find((stat) => stat.displayName === 'Records scanned')!
        .value!;
      for (let i = 1; i < 4; i++) {
        fakeFrames[i].meta!.stats = [
          {
            displayName: 'Records scanned',
            value: initialRecordsMatched,
          },
        ];
      }

      const finalRecordsMatched = fakeFrames[9].meta!.stats!.find((stat) => stat.displayName === 'Records scanned')!
        .value!;
      for (let i = 10; i < fakeFrames.length; i++) {
        fakeFrames[i].meta!.stats = [
          {
            displayName: 'Records scanned',
            value: finalRecordsMatched,
          },
        ];
      }

      let i = 0;
      jest.spyOn(ds, 'makeLogActionRequest').mockImplementation((subtype: LogAction) => {
        if (subtype === 'GetQueryResults') {
          const mockObservable = of([fakeFrames[i]]);
          i++;
          return mockObservable;
        } else {
          return of([]);
        }
      });

      const myResponse = await ds.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }]).toPromise();

      const expectedData = [
        {
          ...fakeFrames[14],
          meta: {
            custom: {
              Status: 'Cancelled',
            },
            stats: fakeFrames[14].meta!.stats,
          },
        },
      ];

      expect(myResponse).toEqual({
        data: expectedData,
        key: 'test-key',
        state: 'Done',
        error: {
          type: DataQueryErrorType.Timeout,
          message: `error: query timed out after ${MAX_ATTEMPTS} attempts`,
        },
      });
      expect(i).toBe(15);
    });

    it('should continue querying as long as new data is being received', async () => {
      const { ds } = getTestContext();
      const fakeFrames = genMockFrames(15);

      let i = 0;
      jest.spyOn(ds, 'makeLogActionRequest').mockImplementation((subtype: LogAction) => {
        if (subtype === 'GetQueryResults') {
          const mockObservable = of([fakeFrames[i]]);
          i++;
          return mockObservable;
        } else {
          return of([]);
        }
      });

      const myResponse = await ds.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }]).toPromise();
      expect(myResponse).toEqual({
        data: [fakeFrames[fakeFrames.length - 1]],
        key: 'test-key',
        state: 'Done',
      });
      expect(i).toBe(15);
    });

    it('should stop querying when results come back with status "Complete"', async () => {
      const { ds } = getTestContext();
      const fakeFrames = genMockFrames(3);
      let i = 0;
      jest.spyOn(ds, 'makeLogActionRequest').mockImplementation((subtype: LogAction) => {
        if (subtype === 'GetQueryResults') {
          const mockObservable = of([fakeFrames[i]]);
          i++;
          return mockObservable;
        } else {
          return of([]);
        }
      });

      const myResponse = await ds.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }]).toPromise();

      expect(myResponse).toEqual({
        data: [fakeFrames[2]],
        key: 'test-key',
        state: 'Done',
      });
      expect(i).toBe(3);
    });

    it('should call the replace method on provided log groups', () => {
      const { ds } = getTestContext();
      const replaceSpy = jest.spyOn(ds, 'replace').mockImplementation((target: string) => target);
      ds.makeLogActionRequest('StartQuery', [
        {
          queryString: 'test query string',
          region: 'default',
          logGroupNames: ['log-group', '${my_var}Variable', 'Cool${other_var}'],
        },
      ]);

      expect(replaceSpy).toBeCalledWith('log-group', undefined, true, 'log groups');
      expect(replaceSpy).toBeCalledWith('${my_var}Variable', undefined, true, 'log groups');
      expect(replaceSpy).toBeCalledWith('Cool${other_var}', undefined, true, 'log groups');
    });
  });

  describe('When performing CloudWatch metrics query', () => {
    const query: any = {
      range: defaultTimeRange,
      rangeRaw: { from: 1483228800, to: 1483232400 },
      targets: [
        {
          type: 'Metrics',
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
          type: 'Metrics',
          error: '',
          refId: 'A',
          meta: {},
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

    it('should generate the correct query', async () => {
      const { ds, fetchMock } = getTestContext({ response });

      await expect(ds.query(query)).toEmitValuesWith(() => {
        expect(fetchMock.mock.calls[0][0].data.queries).toMatchObject(
          expect.arrayContaining([
            expect.objectContaining({
              namespace: query.targets[0].namespace,
              metricName: query.targets[0].metricName,
              dimensions: { InstanceId: ['i-12345678'] },
              statistics: query.targets[0].statistics,
              period: query.targets[0].period,
            }),
          ])
        );
      });
    });

    it('should generate the correct query with interval variable', async () => {
      const period: CustomVariableModel = {
        ...initialVariableModelState,
        id: 'period',
        name: 'period',
        index: 0,
        current: { value: '10m', text: '10m', selected: true },
        options: [{ value: '10m', text: '10m', selected: true }],
        multi: false,
        includeAll: false,
        query: '',
        hide: VariableHide.dontHide,
        type: 'custom',
      };
      const templateSrv = new TemplateSrv();
      templateSrv.init([period]);

      const query: any = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            type: 'Metrics',
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

      const { ds, fetchMock } = getTestContext({ response, templateSrv });

      await expect(ds.query(query)).toEmitValuesWith(() => {
        expect(fetchMock.mock.calls[0][0].data.queries[0].period).toEqual('600');
      });
    });

    it.each(['pNN.NN', 'p9', 'p99.', 'p99.999'])('should cancel query for invalid extended statistics (%s)', (stat) => {
      const { ds } = getTestContext({ response });
      const query = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            type: 'Metrics',
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

      expect(ds.query.bind(ds, query)).toThrow(/Invalid extended statistics/);
    });

    it('should return series list', async () => {
      const { ds } = getTestContext({ response });

      await expect(ds.query(query)).toEmitValuesWith((received) => {
        const result = received[0];
        expect(getFrameDisplayName(result.data[0])).toBe(response.results.A.series[0].name);
        expect(result.data[0].fields[1].values.buffer[0]).toBe(response.results.A.series[0].points[0][0]);
      });
    });

    describe('and throttling exception is thrown', () => {
      const partialQuery = {
        type: 'Metrics',
        namespace: 'AWS/EC2',
        metricName: 'CPUUtilization',
        dimensions: {
          InstanceId: 'i-12345678',
        },
        statistics: ['Average'],
        period: '300',
        expression: '',
      };

      const query: any = {
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
      });

      it('should display one alert error message per region+datasource combination', async () => {
        const { ds } = getTestContext({ response: backendErrorResponse, throws: true });
        const memoizedDebounceSpy = jest.spyOn(ds, 'debouncedAlert');

        await expect(ds.query(query)).toEmitValuesWith((received) => {
          expect(memoizedDebounceSpy).toHaveBeenCalledWith('TestDatasource', 'us-east-1');
          expect(memoizedDebounceSpy).toHaveBeenCalledWith('TestDatasource', 'us-east-2');
          expect(memoizedDebounceSpy).toHaveBeenCalledWith('TestDatasource', 'eu-north-1');
          expect(memoizedDebounceSpy).toBeCalledTimes(3);
        });
      });
    });

    describe('when regions query is used', () => {
      describe('and region param is left out', () => {
        it('should use the default region', async () => {
          const { ds, instanceSettings } = getTestContext();
          ds.doMetricQueryRequest = jest.fn().mockResolvedValue([]);

          await ds.metricFindQuery('metrics(testNamespace)');

          expect(ds.doMetricQueryRequest).toHaveBeenCalledWith('metrics', {
            namespace: 'testNamespace',
            region: instanceSettings.jsonData.defaultRegion,
          });
        });
      });

      describe('and region param is defined by user', () => {
        it('should use the user defined region', async () => {
          const { ds } = getTestContext();
          ds.doMetricQueryRequest = jest.fn().mockResolvedValue([]);

          await ds.metricFindQuery('metrics(testNamespace2, custom-region)');

          expect(ds.doMetricQueryRequest).toHaveBeenCalledWith('metrics', {
            namespace: 'testNamespace2',
            region: 'custom-region',
          });
        });
      });
    });
  });

  describe('When query region is "default"', () => {
    it('should return the datasource region if empty or "default"', () => {
      const { ds, instanceSettings } = getTestContext();
      const defaultRegion = instanceSettings.jsonData.defaultRegion;

      expect(ds.getActualRegion()).toBe(defaultRegion);
      expect(ds.getActualRegion('')).toBe(defaultRegion);
      expect(ds.getActualRegion('default')).toBe(defaultRegion);
    });

    it('should return the specified region if specified', () => {
      const { ds } = getTestContext();

      expect(ds.getActualRegion('some-fake-region-1')).toBe('some-fake-region-1');
    });

    it('should query for the datasource region if empty or "default"', async () => {
      const { ds, instanceSettings } = getTestContext();
      const performTimeSeriesQueryMock = jest.spyOn(ds, 'performTimeSeriesQuery').mockReturnValue(of({}));

      const query: any = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            type: 'Metrics',
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

      await expect(ds.query(query)).toEmitValuesWith(() => {
        expect(performTimeSeriesQueryMock.mock.calls[0][0].queries[0].region).toBe(
          instanceSettings.jsonData.defaultRegion
        );
      });
    });
  });

  describe('When interpolating variables', () => {
    it('should return an empty array if no queries are provided', () => {
      const templateSrv: any = { replace: jest.fn() };
      const { ds } = getTestContext({ templateSrv });

      expect(ds.interpolateVariablesInQueries([], {})).toHaveLength(0);
    });

    it('should replace correct variables in CloudWatchLogsQuery', () => {
      const templateSrv: any = { replace: jest.fn() };
      const { ds } = getTestContext({ templateSrv });
      const variableName = 'someVar';
      const logQuery: CloudWatchLogsQuery = {
        id: 'someId',
        refId: 'someRefId',
        queryMode: 'Logs',
        expression: `$${variableName}`,
        region: `$${variableName}`,
      };

      ds.interpolateVariablesInQueries([logQuery], {});

      // We interpolate `expression` and `region` in CloudWatchLogsQuery
      expect(templateSrv.replace).toHaveBeenCalledWith(`$${variableName}`, {});
      expect(templateSrv.replace).toHaveBeenCalledTimes(2);
    });

    it('should replace correct variables in CloudWatchMetricsQuery', () => {
      const templateSrv: any = { replace: jest.fn() };
      const { ds } = getTestContext({ templateSrv });
      const variableName = 'someVar';
      const logQuery: CloudWatchMetricsQuery = {
        id: 'someId',
        refId: 'someRefId',
        queryMode: 'Metrics',
        expression: `$${variableName}`,
        region: `$${variableName}`,
        period: `$${variableName}`,
        alias: `$${variableName}`,
        metricName: `$${variableName}`,
        namespace: `$${variableName}`,
        dimensions: {
          [`$${variableName}`]: `$${variableName}`,
        },
        matchExact: false,
        statistics: [],
      };

      ds.interpolateVariablesInQueries([logQuery], {});

      // We interpolate `expression`, `region`, `period`, `alias`, `metricName`, `nameSpace` and `dimensions` in CloudWatchMetricsQuery
      expect(templateSrv.replace).toHaveBeenCalledWith(`$${variableName}`, {});
      expect(templateSrv.replace).toHaveBeenCalledTimes(8);
    });
  });

  describe('When performing CloudWatch query for extended statistics', () => {
    const query: any = {
      range: defaultTimeRange,
      rangeRaw: { from: 1483228800, to: 1483232400 },
      targets: [
        {
          type: 'Metrics',
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
          meta: {},
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

    it('should return series list', async () => {
      const { ds } = getTestContext({ response });

      await expect(ds.query(query)).toEmitValuesWith((received) => {
        const result = received[0];
        expect(getFrameDisplayName(result.data[0])).toBe(response.results.A.series[0].name);
        expect(result.data[0].fields[1].values.buffer[0]).toBe(response.results.A.series[0].points[0][0]);
      });
    });
  });

  describe('When performing CloudWatch query with template variables', () => {
    let templateSrv: TemplateSrv;
    beforeEach(() => {
      const var1: CustomVariableModel = {
        ...initialVariableModelState,
        id: 'var1',
        name: 'var1',
        index: 0,
        current: { value: 'var1-foo', text: 'var1-foo', selected: true },
        options: [{ value: 'var1-foo', text: 'var1-foo', selected: true }],
        multi: false,
        includeAll: false,
        query: '',
        hide: VariableHide.dontHide,
        type: 'custom',
      };
      const var2: CustomVariableModel = {
        ...initialVariableModelState,
        id: 'var2',
        name: 'var2',
        index: 1,
        current: { value: 'var2-foo', text: 'var2-foo', selected: true },
        options: [{ value: 'var2-foo', text: 'var2-foo', selected: true }],
        multi: false,
        includeAll: false,
        query: '',
        hide: VariableHide.dontHide,
        type: 'custom',
      };
      const var3: CustomVariableModel = {
        ...initialVariableModelState,
        id: 'var3',
        name: 'var3',
        index: 2,
        current: { value: ['var3-foo', 'var3-baz'], text: 'var3-foo + var3-baz', selected: true },
        options: [
          { selected: true, value: 'var3-foo', text: 'var3-foo' },
          { selected: false, value: 'var3-bar', text: 'var3-bar' },
          { selected: true, value: 'var3-baz', text: 'var3-baz' },
        ],
        multi: true,
        includeAll: false,
        query: '',
        hide: VariableHide.dontHide,
        type: 'custom',
      };
      const var4: CustomVariableModel = {
        ...initialVariableModelState,
        id: 'var4',
        name: 'var4',
        index: 3,
        options: [
          { selected: true, value: 'var4-foo', text: 'var4-foo' },
          { selected: false, value: 'var4-bar', text: 'var4-bar' },
          { selected: true, value: 'var4-baz', text: 'var4-baz' },
        ],
        current: { value: ['var4-foo', 'var4-baz'], text: 'var4-foo + var4-baz', selected: true },
        multi: true,
        includeAll: false,
        query: '',
        hide: VariableHide.dontHide,
        type: 'custom',
      };
      const variables = [var1, var2, var3, var4];
      const state = convertToStoreState(variables);
      templateSrv = new TemplateSrv(getTemplateSrvDependencies(state));
      templateSrv.init(variables);
    });

    it('should generate the correct query for single template variable', async () => {
      const { ds, fetchMock } = getTestContext({ templateSrv });
      const query: any = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            type: 'Metrics',
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

      await expect(ds.query(query)).toEmitValuesWith(() => {
        expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim2']).toStrictEqual(['var2-foo']);
      });
    });

    it('should generate the correct query in the case of one multilple template variables', async () => {
      const { ds, fetchMock } = getTestContext({ templateSrv });
      const query: any = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            type: 'Metrics',
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

      await expect(ds.query(query)).toEmitValuesWith(() => {
        expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim1']).toStrictEqual(['var1-foo']);
        expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim2']).toStrictEqual(['var2-foo']);
        expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim3']).toStrictEqual(['var3-foo', 'var3-baz']);
      });
    });

    it('should generate the correct query in the case of multilple multi template variables', async () => {
      const { ds, fetchMock } = getTestContext({ templateSrv });
      const query: any = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            type: 'Metrics',
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

      await expect(ds.query(query)).toEmitValuesWith(() => {
        expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim1']).toStrictEqual(['var1-foo']);
        expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim3']).toStrictEqual(['var3-foo', 'var3-baz']);
        expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim4']).toStrictEqual(['var4-foo', 'var4-baz']);
      });
    });

    it('should generate the correct query for multilple template variables, lack scopedVars', async () => {
      const { ds, fetchMock } = getTestContext({ templateSrv });
      const query: any = {
        range: defaultTimeRange,
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            type: 'Metrics',
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

      await expect(ds.query(query)).toEmitValuesWith(() => {
        expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim1']).toStrictEqual(['var1-foo']);
        expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim2']).toStrictEqual(['var2-foo']);
        expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim3']).toStrictEqual(['var3-foo', 'var3-baz']);
      });
    });
  });

  function describeMetricFindQuery(query: any, func: any) {
    describe('metricFindQuery ' + query, () => {
      const scenario: any = {};
      scenario.setup = async (setupCallback: any) => {
        beforeEach(async () => {
          await setupCallback();
          const { ds } = getTestContext({ response: scenario.requestResponse });
          ds.metricFindQuery(query).then((args: any) => {
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

function genMockFrames(numResponses: number): DataFrame[] {
  const recordIncrement = 50;
  const mockFrames: DataFrame[] = [];

  for (let i = 0; i < numResponses; i++) {
    mockFrames.push({
      fields: [],
      meta: {
        custom: {
          Status: i === numResponses - 1 ? CloudWatchLogsQueryStatus.Complete : CloudWatchLogsQueryStatus.Running,
        },
        stats: [
          {
            displayName: 'Records scanned',
            value: (i + 1) * recordIncrement,
          },
        ],
      },
      refId: 'A',
      length: 0,
    });
  }

  return mockFrames;
}

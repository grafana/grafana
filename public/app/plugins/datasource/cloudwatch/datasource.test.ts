import { lastValueFrom, of } from 'rxjs';
import { toArray } from 'rxjs/operators';

import { ArrayVector, DataFrame, dataFrameToJSON, dateTime, Field, MutableDataFrame } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';

import {
  dimensionVariable,
  labelsVariable,
  limitVariable,
  metricVariable,
  namespaceVariable,
  setupMockedDataSource,
} from './__mocks__/CloudWatchDataSource';
import {
  CloudWatchLogsQuery,
  CloudWatchLogsQueryStatus,
  CloudWatchMetricsQuery,
  MetricEditorMode,
  MetricQueryType,
} from './types';

describe('datasource', () => {
  describe('query', () => {
    it('should return error if log query and log groups is not specified', async () => {
      const { datasource } = setupMockedDataSource();
      const observable = datasource.query({ targets: [{ queryMode: 'Logs' as 'Logs' }] } as any);

      await expect(observable).toEmitValuesWith((received) => {
        const response = received[0];
        expect(response.error?.message).toBe('Log group is required');
      });
    });

    it('should return empty response if queries are hidden', async () => {
      const { datasource } = setupMockedDataSource();
      const observable = datasource.query({ targets: [{ queryMode: 'Logs' as 'Logs', hide: true }] } as any);

      await expect(observable).toEmitValuesWith((received) => {
        const response = received[0];
        expect(response.data).toEqual([]);
      });
    });

    it('should interpolate variables in the query', async () => {
      const { datasource, fetchMock } = setupMockedDataSource();
      await lastValueFrom(
        datasource
          .query({
            targets: [
              {
                queryMode: 'Logs',
                region: '$region',
                expression: 'fields $fields',
                logGroupNames: ['/some/$group'],
              },
            ],
          } as any)
          .pipe(toArray())
      );
      expect(fetchMock.mock.calls[0][0].data.queries[0]).toMatchObject({
        queryString: 'fields templatedField',
        logGroupNames: ['/some/templatedGroup'],
        region: 'templatedRegion',
      });
    });

    it('should add links to log queries', async () => {
      const { datasource } = setupForLogs();
      const observable = datasource.query({
        targets: [
          {
            queryMode: 'Logs',
            logGroupNames: ['test'],
            refId: 'a',
          },
        ],
      } as any);

      const emits = await lastValueFrom(observable.pipe(toArray()));
      expect(emits).toHaveLength(1);
      expect(emits[0].data[0].fields.find((f: Field) => f.name === '@xrayTraceId').config.links).toMatchObject([
        {
          title: 'Xray',
          url: '',
          internal: {
            query: { query: '${__value.raw}', region: 'us-west-1', queryType: 'getTrace' },
            datasourceUid: 'xray',
            datasourceName: 'Xray',
          },
        },
      ]);

      expect(emits[0].data[0].fields.find((f: Field) => f.name === '@message').config.links).toMatchObject([
        {
          title: 'View in CloudWatch console',
          url: "https://us-west-1.console.aws.amazon.com/cloudwatch/home?region=us-west-1#logs-insights:queryDetail=~(end~'2020-12-31T19*3a00*3a00.000Z~start~'2020-12-31T19*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'~isLiveTail~false~source~(~'test))",
        },
      ]);
    });

    describe('debouncedCustomAlert', () => {
      const debouncedAlert = jest.fn();
      beforeEach(() => {
        const { datasource } = setupMockedDataSource({
          variables: [
            { ...namespaceVariable, multi: true },
            { ...metricVariable, multi: true },
          ],
        });
        datasource.debouncedCustomAlert = debouncedAlert;
        datasource.performTimeSeriesQuery = jest.fn().mockResolvedValue([]);
        datasource.query({
          targets: [
            {
              queryMode: 'Metrics',
              id: '',
              region: 'us-east-2',
              namespace: namespaceVariable.id,
              metricName: metricVariable.id,
              period: '',
              alias: '',
              dimensions: {},
              matchExact: true,
              statistic: '',
              refId: '',
              expression: 'x * 2',
              metricQueryType: MetricQueryType.Search,
              metricEditorMode: MetricEditorMode.Code,
            },
          ],
        } as any);
      });
      it('should show debounced alert for namespace and metric name', async () => {
        expect(debouncedAlert).toHaveBeenCalledWith(
          'CloudWatch templating error',
          'Multi template variables are not supported for namespace'
        );
        expect(debouncedAlert).toHaveBeenCalledWith(
          'CloudWatch templating error',
          'Multi template variables are not supported for metric name'
        );
      });

      it('should not show debounced alert for region', async () => {
        expect(debouncedAlert).not.toHaveBeenCalledWith(
          'CloudWatch templating error',
          'Multi template variables are not supported for region'
        );
      });
    });
  });

  describe('filterQuery', () => {
    const datasource = setupMockedDataSource().datasource;
    describe('CloudWatchLogsQuery', () => {
      const baseQuery: CloudWatchLogsQuery = {
        queryMode: 'Logs',
        id: '',
        region: '',
        refId: '',
        logGroupNames: ['foo', 'bar'],
      };
      it('should return false if empty logGroupNames', () => {
        expect(datasource.filterQuery({ ...baseQuery, logGroupNames: undefined })).toBeFalsy();
      });
      it('should return true if has logGroupNames', () => {
        expect(datasource.filterQuery(baseQuery)).toBeTruthy();
      });
    });
    describe('CloudWatchMetricsQuery', () => {
      let baseQuery: CloudWatchMetricsQuery;
      beforeEach(() => {
        baseQuery = {
          id: '',
          region: 'us-east-2',
          namespace: '',
          period: '',
          alias: '',
          metricName: '',
          dimensions: {},
          matchExact: true,
          statistic: '',
          expression: '',
          refId: '',
        };
      });

      it('should error if invalid mode', async () => {
        expect(() => datasource.filterQuery(baseQuery)).toThrowError('invalid metric editor mode');
      });

      describe('metric search queries', () => {
        beforeEach(() => {
          baseQuery = {
            ...baseQuery,
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            statistic: 'Average',
            metricQueryType: MetricQueryType.Search,
            metricEditorMode: MetricEditorMode.Builder,
          };
        });

        it('should not allow builder queries that dont have namespace, metric or statistic', async () => {
          expect(datasource.filterQuery({ ...baseQuery, statistic: undefined })).toBeFalsy();
          expect(datasource.filterQuery({ ...baseQuery, metricName: undefined })).toBeFalsy();
          expect(datasource.filterQuery({ ...baseQuery, namespace: '' })).toBeFalsy();
        });

        it('should allow builder queries that have namespace, metric or statistic', async () => {
          expect(datasource.filterQuery(baseQuery)).toBeTruthy();
        });

        it('should not allow code queries that dont have an expression', async () => {
          expect(
            datasource.filterQuery({ ...baseQuery, expression: undefined, metricEditorMode: MetricEditorMode.Code })
          ).toBeFalsy();
        });

        it('should allow code queries that have an expression', async () => {
          expect(
            datasource.filterQuery({ ...baseQuery, expression: 'x * 2', metricEditorMode: MetricEditorMode.Code })
          ).toBeTruthy();
        });
      });

      describe('metric search expression queries', () => {
        beforeEach(() => {
          baseQuery = {
            ...baseQuery,
            metricQueryType: MetricQueryType.Search,
            metricEditorMode: MetricEditorMode.Code,
          };
        });

        it('should not allow queries that dont have an expression', async () => {
          const valid = datasource.filterQuery(baseQuery);
          expect(valid).toBeFalsy();
        });

        it('should allow queries that have an expression', async () => {
          baseQuery.expression = 'SUM([a,x])';
          const valid = datasource.filterQuery(baseQuery);
          expect(valid).toBeTruthy();
        });
      });

      describe('metric query queries', () => {
        beforeEach(() => {
          baseQuery = {
            ...baseQuery,
            metricQueryType: MetricQueryType.Query,
            metricEditorMode: MetricEditorMode.Code,
          };
        });

        it('should not allow queries that dont have a sql expresssion', async () => {
          const valid = datasource.filterQuery(baseQuery);
          expect(valid).toBeFalsy();
        });

        it('should allow queries that have a sql expresssion', async () => {
          baseQuery.sqlExpression = 'select SUM(CPUUtilization) from "AWS/EC2"';
          const valid = datasource.filterQuery(baseQuery);
          expect(valid).toBeTruthy();
        });
      });
    });
  });

  describe('resource requests', () => {
    it('should map resource response to metric response', async () => {
      const datasource = setupMockedDataSource().datasource;
      datasource.doMetricResourceRequest = jest.fn().mockResolvedValue([
        {
          text: 'AWS/EC2',
          value: 'CPUUtilization',
        },
        {
          text: 'AWS/Redshift',
          value: 'CPUPercentage',
        },
      ]);
      const allMetrics = await datasource.getAllMetrics('us-east-2');
      expect(allMetrics[0].metricName).toEqual('CPUUtilization');
      expect(allMetrics[0].namespace).toEqual('AWS/EC2');
      expect(allMetrics[1].metricName).toEqual('CPUPercentage');
      expect(allMetrics[1].namespace).toEqual('AWS/Redshift');
    });
  });

  describe('performTimeSeriesQuery', () => {
    it('should return the same length of data as result', async () => {
      const { datasource } = setupMockedDataSource({
        data: {
          results: {
            a: { refId: 'a', series: [{ name: 'cpu', points: [1, 1] }], meta: {} },
            b: { refId: 'b', series: [{ name: 'memory', points: [2, 2] }], meta: {} },
          },
        },
      });

      const observable = datasource.performTimeSeriesQuery(
        {
          queries: [
            { datasourceId: 1, refId: 'a' },
            { datasourceId: 1, refId: 'b' },
          ],
        } as any,
        { from: dateTime(), to: dateTime() } as any
      );

      await expect(observable).toEmitValuesWith((received) => {
        const response = received[0];
        expect(response.data.length).toEqual(2);
      });
    });

    it('sets fields.config.interval based on period', async () => {
      const { datasource } = setupMockedDataSource({
        data: {
          results: {
            a: {
              refId: 'a',
              series: [{ name: 'cpu', points: [1, 2], meta: { custom: { period: 60 } } }],
            },
            b: {
              refId: 'b',
              series: [{ name: 'cpu', points: [1, 2], meta: { custom: { period: 120 } } }],
            },
          },
        },
      });

      const observable = datasource.performTimeSeriesQuery(
        {
          queries: [{ datasourceId: 1, refId: 'a' }],
        } as any,
        { from: dateTime(), to: dateTime() } as any
      );

      await expect(observable).toEmitValuesWith((received) => {
        const response = received[0];
        expect(response.data[0].fields[0].config.interval).toEqual(60000);
        expect(response.data[1].fields[0].config.interval).toEqual(120000);
      });
    });
  });

  describe('describeLogGroup', () => {
    it('replaces region correctly in the query', async () => {
      const { datasource, fetchMock } = setupMockedDataSource();
      await datasource.describeLogGroups({ region: 'default' });
      expect(fetchMock.mock.calls[0][0].data.queries[0].region).toBe('us-west-1');

      await datasource.describeLogGroups({ region: 'eu-east' });
      expect(fetchMock.mock.calls[1][0].data.queries[0].region).toBe('eu-east');
    });
  });

  describe('template variable interpolation', () => {
    it('interpolates variables correctly', async () => {
      const { datasource, fetchMock } = setupMockedDataSource({
        variables: [namespaceVariable, metricVariable, labelsVariable, limitVariable],
      });
      datasource.handleMetricQueries(
        [
          {
            id: '',
            refId: 'a',
            region: 'us-east-2',
            namespace: '',
            period: '',
            alias: '',
            metricName: '',
            dimensions: {},
            matchExact: true,
            statistic: '',
            expression: '',
            metricQueryType: MetricQueryType.Query,
            metricEditorMode: MetricEditorMode.Code,
            sqlExpression: 'SELECT SUM($metric) FROM "$namespace" GROUP BY ${labels:raw} LIMIT $limit',
          },
        ],
        { range: { from: dateTime(), to: dateTime() } } as any
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queries: expect.arrayContaining([
              expect.objectContaining({
                sqlExpression: `SELECT SUM(CPUUtilization) FROM "AWS/EC2" GROUP BY InstanceId,InstanceType LIMIT 100`,
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('convertMultiFiltersFormat', () => {
    const ds = setupMockedDataSource({ variables: [labelsVariable, dimensionVariable], mockGetVariableName: false });
    it('converts keys and values correctly', () => {
      // the json in this line doesn't matter, but it makes sure that old queries will be parsed
      const filters = { $dimension: ['b'], a: ['${labels:json}', 'bar'] };
      const result = ds.datasource.convertMultiFilterFormat(filters);
      expect(result).toStrictEqual({
        env: ['b'],
        a: ['InstanceId', 'InstanceType', 'bar'],
      });
    });
  });

  describe('getLogGroupFields', () => {
    it('passes region correctly', async () => {
      const { datasource, fetchMock } = setupMockedDataSource();
      fetchMock.mockReturnValueOnce(
        of({
          data: {
            results: {
              A: {
                frames: [
                  dataFrameToJSON(
                    new MutableDataFrame({
                      fields: [
                        { name: 'key', values: [] },
                        { name: 'val', values: [] },
                      ],
                    })
                  ),
                ],
              },
            },
          },
        })
      );
      await datasource.getLogGroupFields({ region: 'us-west-1', logGroupName: 'test' });
      expect(fetchMock.mock.calls[0][0].data.queries[0].region).toBe('us-west-1');
    });
  });
});

function setupForLogs() {
  function envelope(frame: DataFrame) {
    return { data: { results: { a: { refId: 'a', frames: [dataFrameToJSON(frame)] } } } };
  }

  const { datasource, fetchMock } = setupMockedDataSource();

  const startQueryFrame = new MutableDataFrame({ fields: [{ name: 'queryId', values: ['queryid'] }] });
  fetchMock.mockReturnValueOnce(of(envelope(startQueryFrame)));

  const logsFrame = new MutableDataFrame({
    fields: [
      {
        name: '@message',
        values: new ArrayVector(['something']),
      },
      {
        name: '@timestamp',
        values: new ArrayVector([1]),
      },
      {
        name: '@xrayTraceId',
        values: new ArrayVector(['1-613f0d6b-3e7cb34375b60662359611bd']),
      },
    ],
    meta: { custom: { Status: CloudWatchLogsQueryStatus.Complete } },
  });

  fetchMock.mockReturnValueOnce(of(envelope(logsFrame)));

  setDataSourceSrv({
    async get() {
      return {
        name: 'Xray',
      };
    },
  } as any);

  return { datasource, fetchMock };
}

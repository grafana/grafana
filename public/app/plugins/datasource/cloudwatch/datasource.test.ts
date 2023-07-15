import { lastValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';

import { CoreApp, dateTime, Field } from '@grafana/data';

import {
  CloudWatchSettings,
  fieldsVariable,
  logGroupNamesVariable,
  regionVariable,
  setupMockedDataSource,
} from './__mocks__/CloudWatchDataSource';
import { setupForLogs } from './__mocks__/logsTestContext';
import { validLogsQuery, validMetricSearchBuilderQuery } from './__mocks__/queries';
import { TimeRangeMock } from './__mocks__/timeRange';
import {
  CloudWatchDefaultQuery,
  CloudWatchLogsQuery,
  CloudWatchMetricsQuery,
  CloudWatchQuery,
  MetricEditorMode,
  MetricQueryType,
} from './types';

describe('datasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('query', () => {
    it('should not run a query if log groups is not specified', async () => {
      const { datasource, fetchMock } = setupMockedDataSource();
      await lastValueFrom(
        datasource.query({
          targets: [
            {
              queryMode: 'Logs',
              id: '',
              refId: '',
              region: '',
              expression: 'some query string', // missing logGroups and logGroupNames, this query will be not be run
            },
            {
              queryMode: 'Logs',
              id: '',
              refId: '',
              region: '',
              logGroupNames: ['/some/group'],
              expression: 'some query string',
            },
          ],
          requestId: '',
          interval: '',
          intervalMs: 0,
          range: TimeRangeMock,
          scopedVars: {},
          timezone: '',
          app: '',
          startTime: 0,
        })
      );

      expect(fetchMock.mock.calls[0][0].data.queries).toHaveLength(1);
      expect(fetchMock.mock.calls[0][0].data.queries[0]).toMatchObject({
        queryString: 'some query string',
        logGroupNames: ['/some/group'],
        region: 'us-west-1',
      });
    });

    it('should not run a query if query expression is not specified', async () => {
      const { datasource, fetchMock } = setupMockedDataSource();
      await lastValueFrom(
        datasource.query({
          targets: [
            {
              queryMode: 'Logs',
              id: '',
              refId: '',
              region: '',
              logGroupNames: ['/some/group'], // missing query expression, this query will be not be run
            },
            {
              queryMode: 'Logs',
              id: '',
              refId: '',
              region: '',
              logGroupNames: ['/some/group'],
              expression: 'some query string',
            },
          ],
          requestId: '',
          interval: '',
          intervalMs: 0,
          range: TimeRangeMock,
          scopedVars: {},
          timezone: '',
          app: '',
          startTime: 0,
        })
      );

      expect(fetchMock.mock.calls[0][0].data.queries).toHaveLength(1);
      expect(fetchMock.mock.calls[0][0].data.queries[0]).toMatchObject({
        queryString: 'some query string',
        logGroupNames: ['/some/group'],
        region: 'us-west-1',
      });
    });

    it('should return empty response if queries are hidden', async () => {
      const { datasource } = setupMockedDataSource();
      const observable = datasource.query({
        targets: [{ queryMode: 'Logs', hide: true, id: '', refId: '', region: '' }],
        requestId: '',
        interval: '',
        intervalMs: 0,
        range: TimeRangeMock,
        scopedVars: {},
        timezone: '',
        app: '',
        startTime: 0,
      });

      await expect(observable).toEmitValuesWith((received) => {
        const response = received[0];
        expect(response.data).toEqual([]);
      });
    });

    const testTable: Array<{ query: CloudWatchQuery; valid: boolean }> = [
      { query: { ...validLogsQuery, hide: true }, valid: false },
      { query: { ...validLogsQuery, hide: false }, valid: true },
      { query: { ...validMetricSearchBuilderQuery, hide: true }, valid: false },
      { query: { ...validMetricSearchBuilderQuery, hide: true, id: 'queryA' }, valid: true },
      { query: { ...validMetricSearchBuilderQuery, hide: false }, valid: true },
    ];

    test.each(testTable)('should filter out hidden queries unless id is provided', ({ query, valid }) => {
      const { datasource } = setupMockedDataSource();
      expect(datasource.filterQuery(query)).toEqual(valid);
    });

    it('should interpolate variables in the query', async () => {
      const { datasource, fetchMock } = setupMockedDataSource({
        variables: [fieldsVariable, regionVariable],
      });
      await lastValueFrom(
        datasource
          .query({
            targets: [
              {
                id: '',
                refId: '',
                queryMode: 'Logs',
                region: '$region',
                expression: 'fields $fields',
                logGroupNames: ['/some/group'],
              },
            ],
            requestId: '',
            interval: '',
            intervalMs: 0,
            range: TimeRangeMock,
            scopedVars: {},
            timezone: '',
            app: '',
            startTime: 0,
          })
          .pipe(toArray())
      );
      expect(fetchMock.mock.calls[0][0].data.queries[0]).toMatchObject({
        queryString: 'fields templatedField',
        logGroupNames: ['/some/group'],
        region: 'templatedRegion',
      });
    });

    it('should interpolate multi-value template variable for log group names in the query', async () => {
      const { datasource, fetchMock } = setupMockedDataSource({
        variables: [fieldsVariable, logGroupNamesVariable, regionVariable],
        mockGetVariableName: false,
      });
      await lastValueFrom(
        datasource
          .query({
            targets: [
              {
                id: '',
                refId: '',
                queryMode: 'Logs',
                region: '$region',
                expression: 'fields $fields',
                logGroupNames: ['$groups'],
              },
            ],
            requestId: '',
            interval: '',
            intervalMs: 0,
            range: TimeRangeMock,
            scopedVars: {},
            timezone: '',
            app: '',
            startTime: 0,
          })
          .pipe(toArray())
      );
      expect(fetchMock.mock.calls[0][0].data.queries[0]).toMatchObject({
        queryString: 'fields templatedField',
        logGroupNames: ['templatedGroup-1', 'templatedGroup-2'],
        region: 'templatedRegion',
      });
    });

    it('should add links to log queries', async () => {
      const { datasource, timeSrv } = setupForLogs();
      timeSrv.timeRange = () => {
        const time = dateTime('2021-01-01T01:00:00Z');
        const range = {
          from: time.subtract(6, 'hour'),
          to: time,
        };

        return {
          ...range,
          raw: range,
        };
      };

      const observable = datasource.query({
        targets: [
          {
            id: '',
            region: '',
            queryMode: 'Logs',
            logGroupNames: ['test'],
            expression: 'some query',
            refId: 'a',
          },
        ],
        requestId: '',
        interval: '',
        intervalMs: 0,
        range: TimeRangeMock,
        scopedVars: {},
        timezone: '',
        app: '',
        startTime: 0,
      });

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
          url: "https://us-west-1.console.aws.amazon.com/cloudwatch/home?region=us-west-1#logs-insights:queryDetail=~(end~'2020-12-31T19*3a00*3a00.000Z~start~'2020-12-31T19*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'some*20query~isLiveTail~false~source~(~'test))",
        },
      ]);
    });
  });

  describe('resource requests', () => {
    it('should map resource response to metric response', async () => {
      const datasource = setupMockedDataSource({
        getMock: jest.fn().mockResolvedValue([
          { value: { namespace: 'AWS/EC2', name: 'CPUUtilization' } },
          {
            value: { namespace: 'AWS/Redshift', name: 'CPUPercentage' },
          },
        ]),
      }).datasource;
      const allMetrics = await datasource.resources.getAllMetrics({ region: 'us-east-2' });
      expect(allMetrics[0].metricName).toEqual('CPUUtilization');
      expect(allMetrics[0].namespace).toEqual('AWS/EC2');
      expect(allMetrics[1].metricName).toEqual('CPUPercentage');
      expect(allMetrics[1].namespace).toEqual('AWS/Redshift');
    });
  });

  describe('when interpolating variables', () => {
    it('should return an empty array if no queries are provided', () => {
      const { datasource } = setupMockedDataSource();

      expect(datasource.interpolateVariablesInQueries([], {})).toHaveLength(0);
    });

    it('should replace correct variables in CloudWatchLogsQuery', () => {
      const { datasource, templateService } = setupMockedDataSource();
      templateService.replace = jest.fn();
      const variableName = 'someVar';
      const logQuery: CloudWatchLogsQuery = {
        queryMode: 'Logs',
        expression: `$${variableName}`,
        region: `$${variableName}`,
        id: '',
        refId: '',
      };

      datasource.interpolateVariablesInQueries([logQuery], {});

      expect(templateService.replace).toHaveBeenCalledWith(`$${variableName}`, {});
      expect(templateService.replace).toHaveBeenCalledTimes(1);
    });

    it('should replace correct variables in CloudWatchMetricsQuery', () => {
      const { datasource, templateService } = setupMockedDataSource();
      templateService.replace = jest.fn();
      templateService.getVariableName = jest.fn();
      const variableName = 'someVar';
      const metricsQuery: CloudWatchMetricsQuery = {
        queryMode: 'Metrics',
        id: 'someId',
        refId: 'someRefId',
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
        statistic: '',
        sqlExpression: `$${variableName}`,
      };

      datasource.interpolateVariablesInQueries([metricsQuery], {});

      // We interpolate `expression`, `sqlExpression`, `region`, `period`, `alias`, `metricName`, `dimensions`, and `nameSpace` in CloudWatchMetricsQuery
      expect(templateService.replace).toHaveBeenCalledWith(`$${variableName}`, {});
      expect(templateService.replace).toHaveBeenCalledTimes(8);

      expect(templateService.getVariableName).toHaveBeenCalledWith(`$${variableName}`);
      expect(templateService.getVariableName).toHaveBeenCalledTimes(1);
    });
  });

  describe('when setting default query', () => {
    it('should set default query to be a Metrics query', () => {
      const { datasource } = setupMockedDataSource();
      expect(datasource.getDefaultQuery(CoreApp.PanelEditor).queryMode).toEqual('Metrics');
    });
    it('should set default log groups in default query', () => {
      const { datasource } = setupMockedDataSource({
        customInstanceSettings: {
          ...CloudWatchSettings,
          jsonData: { ...CloudWatchSettings.jsonData, defaultLogGroups: ['testLogGroup'] },
        },
      });
      expect((datasource.getDefaultQuery(CoreApp.PanelEditor) as CloudWatchDefaultQuery).logGroupNames).toEqual([
        'testLogGroup',
      ]);
    });
    it('should set default values from metrics query', () => {
      const { datasource } = setupMockedDataSource();
      expect(datasource.getDefaultQuery(CoreApp.PanelEditor).region).toEqual('default');
      expect((datasource.getDefaultQuery(CoreApp.PanelEditor) as CloudWatchDefaultQuery).statistic).toEqual('Average');
      expect((datasource.getDefaultQuery(CoreApp.PanelEditor) as CloudWatchDefaultQuery).metricQueryType).toEqual(
        MetricQueryType.Search
      );
      expect((datasource.getDefaultQuery(CoreApp.PanelEditor) as CloudWatchDefaultQuery).metricEditorMode).toEqual(
        MetricEditorMode.Builder
      );
      expect((datasource.getDefaultQuery(CoreApp.PanelEditor) as CloudWatchDefaultQuery).matchExact).toEqual(true);
    });
  });
});

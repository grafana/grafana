import { lastValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';

import { CoreApp, Field } from '@grafana/data';

import {
  CloudWatchSettings,
  fieldsVariable,
  logGroupNamesVariable,
  regionVariable,
  setupMockedDataSource,
} from './mocks/CloudWatchDataSource';
import { setupForLogs } from './mocks/logsTestContext';
import { validLogsQuery, validMetricSearchBuilderQuery } from './mocks/queries';
import { TimeRangeMock } from './mocks/timeRange';
import {
  CloudWatchDefaultQuery,
  CloudWatchLogsQuery,
  CloudWatchLogsRequest,
  CloudWatchMetricsQuery,
  CloudWatchQuery,
  LogsQueryLanguage,
  MetricEditorMode,
  MetricQueryType,
} from './types';
import * as templateUtils from './utils/templateVariableUtils';

describe('datasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('query', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    describe('query filtering', () => {
      const testCases: Array<{
        targets: CloudWatchQuery[];
        queryLanguage: string | LogsQueryLanguage;
        expectedOutput: Partial<CloudWatchLogsRequest>;
      }> = [
        {
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
          expectedOutput: {
            queryString: 'some query string',
            logGroupNames: ['/some/group'],
            region: 'us-west-1',
          },
          queryLanguage: 'undefined',
        },
        {
          targets: [
            {
              queryMode: 'Logs',
              queryLanguage: LogsQueryLanguage.CWLI,
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
          expectedOutput: {
            queryString: 'some query string',
            logGroupNames: ['/some/group'],
            region: 'us-west-1',
          },
          queryLanguage: LogsQueryLanguage.CWLI,
        },
        {
          targets: [
            {
              queryMode: 'Logs',
              queryLanguage: LogsQueryLanguage.PPL,
              id: '',
              refId: '',
              region: '',
              expression: 'some query string', // missing logGroups and logGroupNames, this query will be not be run
            },
            {
              queryMode: 'Logs',
              queryLanguage: LogsQueryLanguage.CWLI,
              id: '',
              refId: '',
              region: '',
              logGroupNames: ['/some/group'],
              expression: 'some query string',
            },
          ],
          expectedOutput: {
            queryString: 'some query string',
            logGroupNames: ['/some/group'],
            region: 'us-west-1',
          },
          queryLanguage: LogsQueryLanguage.PPL,
        },
        {
          targets: [
            {
              queryMode: 'Logs',
              queryLanguage: LogsQueryLanguage.SQL,
              id: '',
              refId: '',
              region: '',
              expression: 'some query string',
            },
          ],
          expectedOutput: {
            queryString: 'some query string',
            region: 'us-west-1',
          },
          queryLanguage: LogsQueryLanguage.SQL,
        },
      ];
      testCases.forEach(async (testCase) => {
        it(`should filter out query with no log groups when query language is ${testCase.queryLanguage}`, async () => {
          const { datasource, queryMock } = setupMockedDataSource();
          await lastValueFrom(
            datasource.query({
              targets: testCase.targets,
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

          expect(queryMock.mock.calls[0][0].targets).toHaveLength(1);
          expect(queryMock.mock.calls[0][0].targets[0]).toMatchObject(testCase.expectedOutput);
        });
      });
    });

    it('should not run a query if query expression is not specified', async () => {
      const { datasource, queryMock } = setupMockedDataSource();
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

      expect(queryMock.mock.calls[0][0].targets).toHaveLength(1);
      expect(queryMock.mock.calls[0][0].targets[0]).toMatchObject({
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
      const { datasource, queryMock } = setupMockedDataSource({
        variables: [fieldsVariable, regionVariable, logGroupNamesVariable],
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
                logGroups: [{ name: '$groups', arn: '$groups' }],
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
      expect(queryMock.mock.calls[0][0].targets[0]).toMatchObject({
        queryString: 'fields templatedField',
        logGroups: [
          { name: 'templatedGroup-arn-1', arn: 'templatedGroup-arn-1' },
          { name: 'templatedGroup-arn-2', arn: 'templatedGroup-arn-2' },
        ],
        logGroupNames: ['/some/group'],
        region: 'templatedRegion',
      });
    });

    it('should interpolate multi-value template variable for log group names in the query', async () => {
      const { datasource, queryMock } = setupMockedDataSource({
        variables: [fieldsVariable, logGroupNamesVariable, regionVariable],
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
      expect(queryMock.mock.calls[0][0].targets[0]).toMatchObject({
        queryString: 'fields templatedField',
        logGroupNames: ['templatedGroup-1', 'templatedGroup-2'],
        region: 'templatedRegion',
      });
    });

    it('should add links to log queries', async () => {
      const { datasource } = setupForLogs();

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
          url: "https://us-west-1.console.aws.amazon.com/cloudwatch/home?region=us-west-1#logs-insights:queryDetail=~(end~'2016-12-31T16*3a00*3a00.000Z~start~'2016-12-31T15*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'some*20query~isLiveTail~false~source~(~'test))",
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
      const { datasource, templateService } = setupMockedDataSource({ variables: [logGroupNamesVariable] });
      templateService.replace = jest.fn().mockImplementation(() => 'resolved1|resolved2');
      const logQuery: CloudWatchLogsQuery = {
        queryMode: 'Logs',
        expression: `$expressionVar`,
        region: `$regionVar`,
        logGroups: [{ name: '$groups', arn: '$groups' }],
        id: '',
        refId: '',
      };

      datasource.interpolateVariablesInQueries([logQuery], {});

      expect(templateService.replace).toHaveBeenNthCalledWith(1, '$regionVar', {});
      expect(templateService.replace).toHaveBeenNthCalledWith(2, '$groups', {}, 'pipe');
      expect(templateService.replace).toHaveBeenNthCalledWith(3, '$expressionVar', {}, undefined);
      expect(templateService.replace).toHaveBeenCalledTimes(3);
    });

    it('should replace correct variables in CloudWatchMetricsQuery', () => {
      const { datasource, templateService } = setupMockedDataSource();
      templateService.replace = jest.fn();
      const mockGetVariableName = jest
        .spyOn(templateUtils, 'getVariableName')
        .mockImplementation((name: string) => name.replace('$', ''));
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

      expect(mockGetVariableName).toHaveBeenCalledWith(`$${variableName}`);
      expect(mockGetVariableName).toHaveBeenCalledTimes(1);
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
    it('should set default values from logs query', () => {
      const defaultLogGroups = [{ name: 'logName', arn: 'logARN' }];
      const { datasource } = setupMockedDataSource({
        customInstanceSettings: {
          ...CloudWatchSettings,
          jsonData: { ...CloudWatchSettings.jsonData, logGroups: defaultLogGroups },
        },
      });
      expect(datasource.getDefaultQuery(CoreApp.PanelEditor).region).toEqual('default');
      expect((datasource.getDefaultQuery(CoreApp.PanelEditor) as CloudWatchDefaultQuery).queryLanguage).toEqual('CWLI');
      expect((datasource.getDefaultQuery(CoreApp.PanelEditor) as CloudWatchDefaultQuery).logGroups).toEqual(
        defaultLogGroups
      );
    });
  });
});

import { lastValueFrom, of } from 'rxjs';
import { setBackendSrv, setDataSourceSrv } from '@grafana/runtime';
import { ArrayVector, DataFrame, dataFrameToJSON, dateTime, Field, MutableDataFrame } from '@grafana/data';

import { TemplateSrv } from '../../../features/templating/template_srv';
import { CloudWatchDatasource } from './datasource';
import { toArray } from 'rxjs/operators';
import { CloudWatchLogsQueryStatus } from './types';

describe('datasource', () => {
  describe('query', () => {
    it('should return error if log query and log groups is not specified', async () => {
      const { datasource } = setup();
      const observable = datasource.query({
        targets: [
          {
            queryMode: 'Logs' as 'Logs',
          },
        ],
      } as any);

      await expect(observable).toEmitValuesWith((received) => {
        const response = received[0];
        expect(response.error?.message).toBe('Log group is required');
      });
    });

    it('should return empty response if queries are hidden', async () => {
      const { datasource } = setup();
      const observable = datasource.query({
        targets: [
          {
            queryMode: 'Logs' as 'Logs',
            hide: true,
          },
        ],
      } as any);

      await expect(observable).toEmitValuesWith((received) => {
        const response = received[0];
        expect(response.data).toEqual([]);
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
          url:
            "https://us-west-1.console.aws.amazon.com/cloudwatch/home?region=us-west-1#logs-insights:queryDetail=~(end~'2020-12-31T19*3a00*3a00.000Z~start~'2020-12-31T19*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'~isLiveTail~false~source~(~'test))",
        },
      ]);
    });
  });

  describe('performTimeSeriesQuery', () => {
    it('should return the same length of data as result', async () => {
      const { datasource } = setup({
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
  });

  describe('describeLogGroup', () => {
    it('replaces region correctly in the query', async () => {
      const { datasource, fetchMock } = setup();
      await datasource.describeLogGroups({ region: 'default' });
      expect(fetchMock.mock.calls[0][0].data.queries[0].region).toBe('us-west-1');

      await datasource.describeLogGroups({ region: 'eu-east' });
      expect(fetchMock.mock.calls[1][0].data.queries[0].region).toBe('eu-east');
    });
  });
});

function setup({ data = [] }: { data?: any } = {}) {
  const datasource = new CloudWatchDatasource(
    { jsonData: { defaultRegion: 'us-west-1', tracingDatasourceUid: 'xray' } } as any,
    new TemplateSrv(),
    {
      timeRange() {
        const time = dateTime('2021-01-01T01:00:00Z');
        const range = {
          from: time.subtract(6, 'hour'),
          to: time,
        };

        return {
          ...range,
          raw: range,
        };
      },
    } as any
  );
  const fetchMock = jest.fn().mockReturnValue(of({ data }));
  setBackendSrv({ fetch: fetchMock } as any);

  return { datasource, fetchMock };
}

function setupForLogs() {
  function envelope(frame: DataFrame) {
    return { data: { results: { a: { refId: 'a', frames: [dataFrameToJSON(frame)] } } } };
  }

  const { datasource, fetchMock } = setup();

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

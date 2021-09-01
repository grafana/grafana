import { of } from 'rxjs';
import { setBackendSrv } from '@grafana/runtime';
import { dateTime, getDefaultTimeRange } from '@grafana/data';

import { TemplateSrv } from '../../../features/templating/template_srv';
import { CloudWatchDatasource } from './datasource';

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
  const datasource = new CloudWatchDatasource({ jsonData: { defaultRegion: 'us-west-1' } } as any, new TemplateSrv(), {
    timeRange() {
      return getDefaultTimeRange();
    },
  } as any);
  const fetchMock = jest.fn().mockReturnValue(of({ data }));
  setBackendSrv({ fetch: fetchMock } as any);

  return { datasource, fetchMock };
}

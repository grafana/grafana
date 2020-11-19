import { of } from 'rxjs';
import { setBackendSrv } from '@grafana/runtime';
import { dateTime, DefaultTimeRange, observableTester } from '@grafana/data';

import { TemplateSrv } from '../../../features/templating/template_srv';
import { CloudWatchDatasource } from './datasource';

describe('datasource', () => {
  describe('query', () => {
    it('should return error if log query and log groups is not specified', done => {
      const { datasource } = setup();

      observableTester().subscribeAndExpectOnNext({
        observable: datasource.query({
          targets: [
            {
              queryMode: 'Logs' as 'Logs',
            },
          ],
        } as any),
        expect: response => {
          expect(response.error?.message).toBe('Log group is required');
        },
        done,
      });
    });

    it('should return empty response if queries are hidden', done => {
      const { datasource } = setup();

      observableTester().subscribeAndExpectOnNext({
        observable: datasource.query({
          targets: [
            {
              queryMode: 'Logs' as 'Logs',
              hide: true,
            },
          ],
        } as any),
        expect: response => {
          expect(response.data).toEqual([]);
        },
        done,
      });
    });
  });

  describe('performTimeSeriesQuery', () => {
    it('should return the same length of data as result', done => {
      const { datasource } = setup({
        data: {
          results: {
            a: { refId: 'a', series: [{ name: 'cpu', points: [1, 1] }], meta: { gmdMeta: '' } },
            b: { refId: 'b', series: [{ name: 'memory', points: [2, 2] }], meta: { gmdMeta: '' } },
          },
        },
      });
      const buildCloudwatchConsoleUrlMock = jest.spyOn(datasource, 'buildCloudwatchConsoleUrl');
      buildCloudwatchConsoleUrlMock.mockImplementation(() => '');

      observableTester().subscribeAndExpectOnNext({
        observable: datasource.performTimeSeriesQuery(
          {
            queries: [
              { datasourceId: 1, refId: 'a' },
              { datasourceId: 1, refId: 'b' },
            ],
          } as any,
          { from: dateTime(), to: dateTime() } as any
        ),
        expect: response => {
          expect(response.data.length).toEqual(2);
        },
        done,
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
      return DefaultTimeRange;
    },
  } as any);
  const fetchMock = jest.fn().mockReturnValue(of({ data }));
  setBackendSrv({ fetch: fetchMock } as any);

  return { datasource, fetchMock };
}

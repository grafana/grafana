import { CloudWatchDatasource } from './datasource';
import { TemplateSrv } from '../../../features/templating/template_srv';
import { setBackendSrv } from '@grafana/runtime';
import { DataQueryResponse, DefaultTimeRange } from '@grafana/data';

describe('datasource', () => {
  describe('query', () => {
    it('should return error if log query and log groups is not specified', async () => {
      const { datasource } = setup();
      const response: DataQueryResponse = (await datasource
        .query({
          targets: [
            {
              queryMode: 'Logs' as 'Logs',
            },
          ],
        } as any)
        .toPromise()) as any;
      expect(response.error?.message).toBe('Log group is required');
    });

    it('should return empty response if queries are hidden', async () => {
      const { datasource } = setup();
      const response: DataQueryResponse = (await datasource
        .query({
          targets: [
            {
              queryMode: 'Logs' as 'Logs',
              hide: true,
            },
          ],
        } as any)
        .toPromise()) as any;
      expect(response.data).toEqual([]);
    });
  });

  describe('describeLogGroup', () => {
    it('replaces region correctly in the query', async () => {
      const { datasource, datasourceRequestMock } = setup();
      await datasource.describeLogGroups({ region: 'default' });
      expect(datasourceRequestMock.mock.calls[0][0].data.queries[0].region).toBe('us-west-1');

      await datasource.describeLogGroups({ region: 'eu-east' });
      expect(datasourceRequestMock.mock.calls[1][0].data.queries[0].region).toBe('eu-east');
    });
  });
});

function setup() {
  const datasource = new CloudWatchDatasource({ jsonData: { defaultRegion: 'us-west-1' } } as any, new TemplateSrv(), {
    timeRange() {
      return DefaultTimeRange;
    },
  } as any);
  const datasourceRequestMock = jest.fn();
  datasourceRequestMock.mockResolvedValue({ data: [] });
  setBackendSrv({ datasourceRequest: datasourceRequestMock } as any);

  return { datasource, datasourceRequestMock };
}

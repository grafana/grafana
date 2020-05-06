import { CloudWatchDatasource } from './datasource';
import { TemplateSrv } from '../../../features/templating/template_srv';
import { setBackendSrv } from '@grafana/runtime';
import { DefaultTimeRange } from '@grafana/data';

describe('datasource', () => {
  describe('describeLogGroup', () => {
    it('replaces region correctly in the query', async () => {
      const datasource = new CloudWatchDatasource(
        { jsonData: { defaultRegion: 'us-west-1' } } as any,
        new TemplateSrv(),
        {
          timeRange() {
            return DefaultTimeRange;
          },
        } as any
      );
      const datasourceRequestMock = jest.fn();
      datasourceRequestMock.mockResolvedValue({ data: [] });
      setBackendSrv({ datasourceRequest: datasourceRequestMock } as any);

      await datasource.describeLogGroups({ region: 'default' });
      expect(datasourceRequestMock.mock.calls[0][0].data.queries[0].region).toBe('us-west-1');

      await datasource.describeLogGroups({ region: 'eu-east' });
      expect(datasourceRequestMock.mock.calls[1][0].data.queries[0].region).toBe('eu-east');
    });
  });
});

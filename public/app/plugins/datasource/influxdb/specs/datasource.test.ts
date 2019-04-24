import InfluxDatasource from '../datasource';
import $q from 'q';
import { TemplateSrvStub } from 'test/specs/helpers';

describe('InfluxDataSource', () => {
  const ctx: any = {
    backendSrv: {},
    $q: $q,
    templateSrv: new TemplateSrvStub(),
    instanceSettings: { url: 'url', name: 'influxDb', jsonData: {} },
  };

  beforeEach(() => {
    ctx.instanceSettings.url = '/api/datasources/proxy/1';
    ctx.ds = new InfluxDatasource(ctx.instanceSettings, ctx.$q, ctx.backendSrv, ctx.templateSrv);
  });

  describe('When issuing metricFindQuery', () => {
    const query = 'SELECT max(value) FROM measurement WHERE $timeFilter';
    const queryOptions: any = {
      range: {
        from: '2018-01-01T00:00:00Z',
        to: '2018-01-02T00:00:00Z',
      },
    };
    let requestQuery;

    beforeEach(async () => {
      ctx.backendSrv.datasourceRequest = req => {
        requestQuery = req.params.q;
        return ctx.$q.when({
          results: [
            {
              series: [
                {
                  name: 'measurement',
                  columns: ['max'],
                  values: [[1]],
                },
              ],
            },
          ],
        });
      };

      await ctx.ds.metricFindQuery(query, queryOptions).then(_ => {});
    });

    it('should replace $timefilter', () => {
      expect(requestQuery).toMatch('time >= 1514764800000ms and time <= 1514851200000ms');
    });
  });
});

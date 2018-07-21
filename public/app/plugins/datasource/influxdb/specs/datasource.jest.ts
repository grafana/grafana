import InfluxDatasource from '../datasource';
import $q from 'q';
import { TemplateSrvStub } from 'test/specs/helpers';

describe('InfluxDataSource', () => {
  let ctx: any = {
    backendSrv: {},
    $q: $q,
    templateSrv: new TemplateSrvStub(),
    instanceSettings: { url: 'url', name: 'influxDb', jsonData: {} },
  };

  beforeEach(function() {
    ctx.instanceSettings.url = '/api/datasources/proxy/1';
    ctx.ds = new InfluxDatasource(ctx.instanceSettings, ctx.$q, ctx.backendSrv, ctx.templateSrv);
  });

  describe('When issuing metricFindQuery', () => {
    let query = 'SELECT max(value) FROM measurement WHERE $timeFilter';
    let queryOptions: any = {
      range: {
        from: '2018-01-01 00:00:00',
        to: '2018-01-02 00:00:00',
      },
    };
    let requestQuery;

    beforeEach(async () => {
      ctx.backendSrv.datasourceRequest = function(req) {
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

      await ctx.ds.metricFindQuery(query, queryOptions).then(function(_) {});
    });

    it('should replace $timefilter', () => {
      expect(requestQuery).toMatch('time >= 1514761200000ms and time <= 1514847600000ms');
    });
  });
});

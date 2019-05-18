import InfluxDatasource from '../datasource';
import $q from 'q';
import { TemplateSrvStub } from 'test/specs/helpers';

describe('InfluxDataSource', () => {
  const ctx: any = {
    backendSrv: {},
    $q: $q,
    templateSrv: new TemplateSrvStub(),
    instanceSettings: { url: 'url', name: 'influxDb', jsonData: { httpMode: 'GET' } },
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
    let requestQuery, requestMethod, requestData;

    beforeEach(async () => {
      ctx.backendSrv.datasourceRequest = req => {
        requestMethod = req.method;
        requestQuery = req.params.q;
        requestData = req.data;
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

    it('should use the HTTP GET method', () => {
      expect(requestMethod).toBe('GET');
    });

    it('should not have any data in request body', () => {
      expect(requestData).toBeNull();
    });
  });
});

describe('InfluxDataSource in POST query mode', () => {
  const ctx: any = {
    backendSrv: {},
    $q: $q,
    templateSrv: new TemplateSrvStub(),
    instanceSettings: { url: 'url', name: 'influxDb', jsonData: { httpMode: 'POST' } },
  };

  beforeEach(() => {
    ctx.instanceSettings.url = '/api/datasources/proxy/1';
    ctx.ds = new InfluxDatasource(ctx.instanceSettings, ctx.$q, ctx.backendSrv, ctx.templateSrv);
  });

  describe('When issuing metricFindQuery', () => {
    const query = 'SELECT max(value) FROM measurement';
    const queryOptions: any = {};
    let requestMethod, requestQueryParameter, queryEncoded, requestQuery;

    beforeEach(async () => {
      ctx.backendSrv.datasourceRequest = req => {
        requestMethod = req.method;
        requestQueryParameter = req.params;
        requestQuery = req.data;
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

      queryEncoded = await ctx.ds.serializeParams({ q: query });
      await ctx.ds.metricFindQuery(query, queryOptions).then(_ => {});
    });

    it('should have the query form urlencoded', () => {
      expect(requestQuery).toBe(queryEncoded);
    });

    it('should use the HTTP POST method', () => {
      expect(requestMethod).toBe('POST');
    });

    it('should not have q as a query parameter', () => {
      expect(requestQueryParameter).not.toHaveProperty('q');
    });
  });
});

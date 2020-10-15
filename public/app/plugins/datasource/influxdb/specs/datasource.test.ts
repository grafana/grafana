import InfluxDatasource from '../datasource';

import { TemplateSrvStub } from 'test/specs/helpers';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__

//@ts-ignore
const templateSrv = new TemplateSrvStub();

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

describe('InfluxDataSource', () => {
  const ctx: any = {
    instanceSettings: { url: 'url', name: 'influxDb', jsonData: { httpMode: 'GET' } },
  };

  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  beforeEach(() => {
    jest.clearAllMocks();
    ctx.instanceSettings.url = '/api/datasources/proxy/1';
    ctx.ds = new InfluxDatasource(ctx.instanceSettings, templateSrv);
  });

  describe('When issuing metricFindQuery', () => {
    const query = 'SELECT max(value) FROM measurement WHERE $timeFilter';
    const queryOptions: any = {
      range: {
        from: '2018-01-01T00:00:00Z',
        to: '2018-01-02T00:00:00Z',
      },
    };
    let requestQuery: any, requestMethod: any, requestData: any, response: any;

    beforeEach(async () => {
      datasourceRequestMock.mockImplementation((req: any) => {
        requestMethod = req.method;
        requestQuery = req.params.q;
        requestData = req.data;
        return Promise.resolve({
          data: {
            results: [
              {
                series: [
                  {
                    name: 'measurement',
                    columns: ['name'],
                    values: [['cpu']],
                  },
                ],
              },
            ],
          },
        });
      });

      response = await ctx.ds.metricFindQuery(query, queryOptions);
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

    it('parse response correctly', () => {
      expect(response).toEqual([{ text: 'cpu' }]);
    });
  });

  describe('When getting error on 200 after issuing a query', () => {
    const queryOptions: any = {
      range: {
        from: '2018-01-01T00:00:00Z',
        to: '2018-01-02T00:00:00Z',
      },
      rangeRaw: {
        from: '2018-01-01T00:00:00Z',
        to: '2018-01-02T00:00:00Z',
      },
      targets: [{}],
      timezone: 'UTC',
      scopedVars: {
        interval: { text: '1m', value: '1m' },
        __interval: { text: '1m', value: '1m' },
        __interval_ms: { text: 60000, value: 60000 },
      },
    };

    it('throws an error', async () => {
      datasourceRequestMock.mockImplementation((req: any) => {
        return Promise.resolve({
          data: {
            results: [
              {
                error: 'Query timeout',
              },
            ],
          },
        });
      });

      try {
        await ctx.ds.query(queryOptions).toPromise();
      } catch (err) {
        expect(err.message).toBe('InfluxDB Error: Query timeout');
      }
    });
  });

  describe('InfluxDataSource in POST query mode', () => {
    const ctx: any = {
      instanceSettings: { url: 'url', name: 'influxDb', jsonData: { httpMode: 'POST' } },
    };

    beforeEach(() => {
      ctx.instanceSettings.url = '/api/datasources/proxy/1';
      ctx.ds = new InfluxDatasource(ctx.instanceSettings, templateSrv);
    });

    describe('When issuing metricFindQuery', () => {
      const query = 'SELECT max(value) FROM measurement';
      const queryOptions: any = {};
      let requestMethod: any, requestQueryParameter: any, queryEncoded: any, requestQuery: any;

      beforeEach(async () => {
        datasourceRequestMock.mockImplementation((req: any) => {
          requestMethod = req.method;
          requestQueryParameter = req.params;
          requestQuery = req.data;
          return Promise.resolve({
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
        });

        queryEncoded = await ctx.ds.serializeParams({ q: query });
        await ctx.ds.metricFindQuery(query, queryOptions).then(() => {});
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
});

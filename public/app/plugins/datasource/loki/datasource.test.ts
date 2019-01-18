import LokiDatasource from './datasource';
import { LokiQuery } from './types';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

describe('LokiDatasource', () => {
  const instanceSettings: any = {
    url: 'myloggingurl',
  };

  describe('when querying', () => {
    const backendSrvMock = { datasourceRequest: jest.fn() };

    const templateSrvMock = {
      getAdhocFilters: () => [],
      replace: a => a,
    };

    test('should use default max lines when no limit given', () => {
      const ds = new LokiDatasource(instanceSettings, backendSrvMock, templateSrvMock);
      backendSrvMock.datasourceRequest = jest.fn();
      const options = getQueryOptions<LokiQuery>({ targets: [{ expr: 'foo', refId: 'B' }] });

      ds.query(options);

      expect(backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0].url).toContain('limit=1000');
    });

    test('should use custom max lines if limit is set', () => {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      const customSettings = { ...instanceSettings, jsonData: customData };
      const ds = new LokiDatasource(customSettings, backendSrvMock, templateSrvMock);
      backendSrvMock.datasourceRequest = jest.fn();

      const options = getQueryOptions<LokiQuery>({ targets: [{ expr: 'foo', refId: 'B' }] });
      ds.query(options);

      expect(backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0].url).toContain('limit=20');
    });
  });

  describe('when performing testDataSource', () => {
    let ds;
    let result;

    describe('and call succeeds', () => {
      beforeEach(async () => {
        const backendSrv = {
          async datasourceRequest() {
            return Promise.resolve({
              status: 200,
              data: {
                values: ['avalue'],
              },
            });
          },
        };
        ds = new LokiDatasource(instanceSettings, backendSrv, {});
        result = await ds.testDatasource();
      });

      it('should return successfully', () => {
        expect(result.status).toBe('success');
      });
    });

    describe('and call fails with 401 error', () => {
      beforeEach(async () => {
        const backendSrv = {
          async datasourceRequest() {
            return Promise.reject({
              statusText: 'Unauthorized',
              status: 401,
              data: {
                message: 'Unauthorized',
              },
            });
          },
        };
        ds = new LokiDatasource(instanceSettings, backendSrv, {});
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Unauthorized. 401. Unauthorized');
      });
    });

    describe('and call fails with 404 error', () => {
      beforeEach(async () => {
        const backendSrv = {
          async datasourceRequest() {
            return Promise.reject({
              statusText: 'Not found',
              status: 404,
              data: '404 page not found',
            });
          },
        };
        ds = new LokiDatasource(instanceSettings, backendSrv, {});
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Not found. 404. 404 page not found');
      });
    });

    describe('and call fails with 502 error', () => {
      beforeEach(async () => {
        const backendSrv = {
          async datasourceRequest() {
            return Promise.reject({
              statusText: 'Bad Gateway',
              status: 502,
              data: '',
            });
          },
        };
        ds = new LokiDatasource(instanceSettings, backendSrv, {});
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Bad Gateway. 502');
      });
    });
  });
});

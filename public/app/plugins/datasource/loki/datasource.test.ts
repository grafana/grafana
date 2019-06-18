import LokiDatasource from './datasource';
import { LokiQuery } from './types';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { SeriesData, DataSourceApi } from '@grafana/ui';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';

describe('LokiDatasource', () => {
  const instanceSettings: any = {
    url: 'myloggingurl',
  };

  const testResp = {
    data: {
      streams: [
        {
          entries: [{ ts: '2019-02-01T10:27:37.498180581Z', line: 'hello' }],
          labels: '{}',
        },
      ],
    },
  };

  describe('when querying', () => {
    const backendSrvMock = { datasourceRequest: jest.fn() };
    const backendSrv = (backendSrvMock as unknown) as BackendSrv;

    const templateSrvMock = ({
      getAdhocFilters: (): any[] => [],
      replace: (a: string) => a,
    } as unknown) as TemplateSrv;

    test('should use default max lines when no limit given', () => {
      const ds = new LokiDatasource(instanceSettings, backendSrv, templateSrvMock);
      backendSrvMock.datasourceRequest = jest.fn(() => Promise.resolve(testResp));
      const options = getQueryOptions<LokiQuery>({ targets: [{ expr: 'foo', refId: 'B' }] });

      ds.query(options);

      expect(backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0].url).toContain('limit=1000');
    });

    test('should use custom max lines if limit is set', () => {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      const customSettings = { ...instanceSettings, jsonData: customData };
      const ds = new LokiDatasource(customSettings, backendSrv, templateSrvMock);
      backendSrvMock.datasourceRequest = jest.fn(() => Promise.resolve(testResp));

      const options = getQueryOptions<LokiQuery>({ targets: [{ expr: 'foo', refId: 'B' }] });
      ds.query(options);

      expect(backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0].url).toContain('limit=20');
    });

    test('should return series data', async done => {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      const customSettings = { ...instanceSettings, jsonData: customData };
      const ds = new LokiDatasource(customSettings, backendSrv, templateSrvMock);
      backendSrvMock.datasourceRequest = jest.fn(() => Promise.resolve(testResp));

      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{} foo', refId: 'B' }],
      });

      const res = await ds.query(options);

      const seriesData = res.data[0] as SeriesData;
      expect(seriesData.rows[0][1]).toBe('hello');
      expect(seriesData.meta.limit).toBe(20);
      expect(seriesData.meta.searchWords).toEqual(['(?i)foo']);
      done();
    });
  });

  describe('when performing testDataSource', () => {
    let ds: DataSourceApi<any, any>;
    let result: any;

    describe('and call succeeds', () => {
      beforeEach(async () => {
        const backendSrv = ({
          async datasourceRequest() {
            return Promise.resolve({
              status: 200,
              data: {
                values: ['avalue'],
              },
            });
          },
        } as unknown) as BackendSrv;
        ds = new LokiDatasource(instanceSettings, backendSrv, {} as TemplateSrv);
        result = await ds.testDatasource();
      });

      it('should return successfully', () => {
        expect(result.status).toBe('success');
      });
    });

    describe('and call fails with 401 error', () => {
      beforeEach(async () => {
        const backendSrv = ({
          async datasourceRequest() {
            return Promise.reject({
              statusText: 'Unauthorized',
              status: 401,
              data: {
                message: 'Unauthorized',
              },
            });
          },
        } as unknown) as BackendSrv;
        ds = new LokiDatasource(instanceSettings, backendSrv, {} as TemplateSrv);
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Unauthorized. 401. Unauthorized');
      });
    });

    describe('and call fails with 404 error', () => {
      beforeEach(async () => {
        const backendSrv = ({
          async datasourceRequest() {
            return Promise.reject({
              statusText: 'Not found',
              status: 404,
              data: '404 page not found',
            });
          },
        } as unknown) as BackendSrv;
        ds = new LokiDatasource(instanceSettings, backendSrv, {} as TemplateSrv);
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Not found. 404. 404 page not found');
      });
    });

    describe('and call fails with 502 error', () => {
      beforeEach(async () => {
        const backendSrv = ({
          async datasourceRequest() {
            return Promise.reject({
              statusText: 'Bad Gateway',
              status: 502,
              data: '',
            });
          },
        } as unknown) as BackendSrv;
        ds = new LokiDatasource(instanceSettings, backendSrv, {} as TemplateSrv);
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Bad Gateway. 502');
      });
    });
  });
});

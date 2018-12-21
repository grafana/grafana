import LokiDatasource from './datasource';

describe('LokiDatasource', () => {
  const instanceSettings = {
    url: 'myloggingurl',
  };

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

import StackdriverDataSource from '../datasource';
import { metricDescriptors } from './testData';

describe('StackdriverDataSource', () => {
  describe('when performing testDataSource', () => {
    describe('and call to stackdriver api succeeds', () => {
      let ds;
      let result;
      beforeEach(async () => {
        const backendSrv = {
          async datasourceRequest() {
            return Promise.resolve({ status: 200 });
          },
        };
        ds = new StackdriverDataSource({}, backendSrv);
        result = await ds.testDatasource();
      });
      it('should return successfully', () => {
        expect(result.status).toBe('success');
      });
    });

    describe('and a list of metricDescriptors are returned', () => {
      let ds;
      let result;
      beforeEach(async () => {
        const backendSrv = {
          datasourceRequest: async () => Promise.resolve({ status: 200, data: metricDescriptors }),
        };
        ds = new StackdriverDataSource({}, backendSrv);
        result = await ds.testDatasource();
      });
      it('should return status success', () => {
        expect(result.status).toBe('success');
      });
    });

    describe('and call to stackdriver api fails with 400 error', () => {
      let ds;
      let result;
      beforeEach(async () => {
        const backendSrv = {
          datasourceRequest: async () =>
            Promise.reject({
              statusText: 'Bad Request',
              data: { error: { code: 400, message: 'Field interval.endTime had an invalid value' } },
            }),
        };
        ds = new StackdriverDataSource({}, backendSrv);
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Stackdriver: Bad Request: 400. Field interval.endTime had an invalid value');
      });
    });
  });
});

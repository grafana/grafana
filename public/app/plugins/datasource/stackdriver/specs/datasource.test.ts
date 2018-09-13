import StackdriverDataSource from '../datasource';
import { metricDescriptors } from './testData';
import moment from 'moment';

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

  describe('when performing getProjects', () => {
    describe('and call to resource manager api succeeds', () => {
      let ds;
      let result;
      beforeEach(async () => {
        const response = {
          projects: [
            {
              projectNumber: '853996325002',
              projectId: 'test-project',
              lifecycleState: 'ACTIVE',
              name: 'Test Project',
              createTime: '2015-06-02T14:16:08.520Z',
              parent: {
                type: 'organization',
                id: '853996325002',
              },
            },
          ],
        };
        const backendSrv = {
          async datasourceRequest() {
            return Promise.resolve({ status: 200, data: response });
          },
        };
        ds = new StackdriverDataSource({}, backendSrv);
        result = await ds.getProjects();
      });

      it('should return successfully', () => {
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('test-project');
        expect(result[0].name).toBe('Test Project');
      });
    });
  });

  describe('When performing query', () => {
    const options = {
      range: {
        from: moment.utc('2017-08-22T20:00:00Z'),
        to: moment.utc('2017-08-22T23:59:00Z'),
      },
      rangeRaw: {
        from: 'now-4h',
        to: 'now',
      },
      targets: [
        {
          refId: 'A',
        },
      ],
    };

    describe('and no time series data is returned', () => {
      let ds;
      const response = {
        results: {
          A: {
            refId: 'A',
            meta: {
              rawQuery: 'arawquerystring',
            },
            series: null,
            tables: null,
          },
        },
      };

      beforeEach(() => {
        const backendSrv = {
          datasourceRequest: async () => Promise.resolve({ status: 200, data: response }),
        };
        ds = new StackdriverDataSource({}, backendSrv);
      });

      it('should return a list of datapoints', () => {
        return ds.query(options).then(results => {
          expect(results.data.length).toBe(0);
        });
      });
    });
  });

  describe('when performing getMetricTypes', () => {
    describe('and call to stackdriver api succeeds', () => {});
    let ds;
    let result;
    beforeEach(async () => {
      const backendSrv = {
        async datasourceRequest() {
          return Promise.resolve({
            data: {
              metricDescriptors: [
                {
                  displayName: 'test metric name 1',
                  type: 'test metric type 1',
                },
                {
                  displayName: 'test metric name 2',
                  type: 'test metric type 2',
                },
              ],
            },
          });
        },
      };
      ds = new StackdriverDataSource({}, backendSrv);
      result = await ds.getMetricTypes();
    });
    it('should return successfully', () => {
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('test metric type 1');
      expect(result[0].name).toBe('test metric name 1');
    });
  });
});

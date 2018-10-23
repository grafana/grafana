import StackdriverDataSource from '../datasource';
import { metricDescriptors } from './testData';
import moment from 'moment';
import { TemplateSrvStub } from 'test/specs/helpers';

describe('StackdriverDataSource', () => {
  const instanceSettings = {
    jsonData: {
      defaultProject: 'testproject',
    },
  };
  const templateSrv = new TemplateSrvStub();
  const timeSrv = {};

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
        ds = new StackdriverDataSource(instanceSettings, backendSrv, templateSrv, timeSrv);
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
        ds = new StackdriverDataSource(instanceSettings, backendSrv, templateSrv, timeSrv);
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
              data: {
                error: { code: 400, message: 'Field interval.endTime had an invalid value' },
              },
            }),
        };
        ds = new StackdriverDataSource(instanceSettings, backendSrv, templateSrv, timeSrv);
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Stackdriver: Bad Request: 400. Field interval.endTime had an invalid value');
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
          aggregation: {},
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
        ds = new StackdriverDataSource(instanceSettings, backendSrv, templateSrv, timeSrv);
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
                  type: 'compute.googleapis.com/instance/cpu/test-metric-type-1',
                  description: 'A description',
                },
                {
                  type: 'logging.googleapis.com/user/logbased-metric-with-no-display-name',
                },
              ],
            },
          });
        },
      };
      ds = new StackdriverDataSource(instanceSettings, backendSrv, templateSrv, timeSrv);
      result = await ds.getMetricTypes();
    });
    it('should return successfully', () => {
      expect(result.length).toBe(2);
      expect(result[0].service).toBe('compute.googleapis.com');
      expect(result[0].serviceShortName).toBe('compute');
      expect(result[0].type).toBe('compute.googleapis.com/instance/cpu/test-metric-type-1');
      expect(result[0].displayName).toBe('test metric name 1');
      expect(result[0].description).toBe('A description');
      expect(result[1].type).toBe('logging.googleapis.com/user/logbased-metric-with-no-display-name');
      expect(result[1].displayName).toBe('logging.googleapis.com/user/logbased-metric-with-no-display-name');
    });
  });

  describe('when interpolating a template variable for group bys', () => {
    let interpolated;

    describe('and is single value variable', () => {
      beforeEach(() => {
        templateSrv.data = {
          test: 'groupby1',
        };
        const ds = new StackdriverDataSource(instanceSettings, {}, templateSrv, timeSrv);
        interpolated = ds.interpolateGroupBys(['[[test]]'], {});
      });

      it('should replace the variable with the value', () => {
        expect(interpolated.length).toBe(1);
        expect(interpolated[0]).toBe('groupby1');
      });
    });

    describe('and is multi value variable', () => {
      beforeEach(() => {
        templateSrv.data = {
          test: 'groupby1,groupby2',
        };
        const ds = new StackdriverDataSource(instanceSettings, {}, templateSrv, timeSrv);
        interpolated = ds.interpolateGroupBys(['[[test]]'], {});
      });

      it('should replace the variable with an array of group bys', () => {
        expect(interpolated.length).toBe(2);
        expect(interpolated[0]).toBe('groupby1');
        expect(interpolated[1]).toBe('groupby2');
      });
    });
  });

  describe('unit parsing', () => {
    let ds, res;
    beforeEach(() => {
      ds = new StackdriverDataSource(instanceSettings, {}, templateSrv, timeSrv);
    });
    describe('when theres only one target', () => {
      describe('and the stackdriver unit doesnt have a corresponding grafana unit', () => {
        beforeEach(() => {
          res = ds.resolvePanelUnitFromTargets([{ unit: 'megaseconds' }]);
        });
        it('should return undefined', () => {
          expect(res).toBeUndefined();
        });
      });
      describe('and the stackdriver unit has a corresponding grafana unit', () => {
        beforeEach(() => {
          res = ds.resolvePanelUnitFromTargets([{ unit: 'bit' }]);
        });
        it('should return bits', () => {
          expect(res).toEqual('bits');
        });
      });
    });

    describe('when theres more than one target', () => {
      describe('and all target units are the same', () => {
        beforeEach(() => {
          res = ds.resolvePanelUnitFromTargets([{ unit: 'bit' }, { unit: 'bit' }]);
        });
        it('should return bits', () => {
          expect(res).toEqual('bits');
        });
      });
      describe('and all target units are the same but doesnt have grafana mappings', () => {
        beforeEach(() => {
          res = ds.resolvePanelUnitFromTargets([{ unit: 'megaseconds' }, { unit: 'megaseconds' }]);
        });
        it('should return the default value of undefined', () => {
          expect(res).toBeUndefined();
        });
      });
      describe('and all target units are not the same', () => {
        beforeEach(() => {
          res = ds.resolvePanelUnitFromTargets([{ unit: 'bit' }, { unit: 'min' }]);
        });
        it('should return the default value of undefined', () => {
          expect(res).toBeUndefined();
        });
      });
    });
  });
});

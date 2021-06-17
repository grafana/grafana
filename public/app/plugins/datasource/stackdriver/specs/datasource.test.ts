import StackdriverDataSource from '../datasource';
import { metricDescriptors } from './testData';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CustomVariable } from 'app/features/templating/all';
import { DataSourceInstanceSettings, toUtc } from '@grafana/data';
import { StackdriverOptions } from '../types';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

interface Result {
  status: any;
  message?: any;
}

describe('StackdriverDataSource', () => {
  const instanceSettings = ({
    jsonData: {
      defaultProject: 'testproject',
    },
  } as unknown) as DataSourceInstanceSettings<StackdriverOptions>;
  const templateSrv = new TemplateSrv();
  const timeSrv = {} as TimeSrv;
  const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

  beforeEach(() => {
    jest.clearAllMocks();
    datasourceRequestMock.mockImplementation(jest.fn());
  });

  describe('when performing testDataSource', () => {
    describe('and call to stackdriver api succeeds', () => {
      let ds;
      let result: Result;
      beforeEach(async () => {
        datasourceRequestMock.mockImplementation(() => Promise.resolve({ status: 200 }));
        ds = new StackdriverDataSource(instanceSettings, templateSrv, timeSrv);
        result = await ds.testDatasource();
      });

      it('should return successfully', () => {
        expect(result.status).toBe('success');
      });
    });

    describe('and a list of metricDescriptors are returned', () => {
      let ds;
      let result: Result;
      beforeEach(async () => {
        datasourceRequestMock.mockImplementation(() => Promise.resolve({ status: 200, data: metricDescriptors }));

        ds = new StackdriverDataSource(instanceSettings, templateSrv, timeSrv);
        result = await ds.testDatasource();
      });

      it('should return status success', () => {
        expect(result.status).toBe('success');
      });
    });

    describe('and call to stackdriver api fails with 400 error', () => {
      let ds;
      let result: Result;
      beforeEach(async () => {
        datasourceRequestMock.mockImplementation(() =>
          Promise.reject({
            statusText: 'Bad Request',
            data: {
              error: { code: 400, message: 'Field interval.endTime had an invalid value' },
            },
          })
        );

        ds = new StackdriverDataSource(instanceSettings, templateSrv, timeSrv);
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
        from: toUtc('2017-08-22T20:00:00Z'),
        to: toUtc('2017-08-22T23:59:00Z'),
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
      let ds: StackdriverDataSource;
      const response: any = {
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
        datasourceRequestMock.mockImplementation(() => Promise.resolve({ status: 200, data: response }));
        ds = new StackdriverDataSource(instanceSettings, templateSrv, timeSrv);
      });

      it('should return a list of datapoints', () => {
        return ds.query(options as any).then(results => {
          expect(results.data.length).toBe(0);
        });
      });
    });
  });

  describe('when performing getMetricTypes', () => {
    describe('and call to stackdriver api succeeds', () => {});
    let ds;
    let result: any;
    beforeEach(async () => {
      datasourceRequestMock.mockImplementation(() =>
        Promise.resolve({
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
        })
      );

      ds = new StackdriverDataSource(instanceSettings, templateSrv, timeSrv);
      // @ts-ignore
      result = await ds.getMetricTypes('proj');
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

  describe('when interpolating a template variable for the filter', () => {
    let interpolated: any[];
    describe('and is single value variable', () => {
      beforeEach(() => {
        const filterTemplateSrv = initTemplateSrv('filtervalue1');
        const ds = new StackdriverDataSource(instanceSettings, filterTemplateSrv, timeSrv);
        interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '${test}'], {});
      });

      it('should replace the variable with the value', () => {
        expect(interpolated.length).toBe(3);
        expect(interpolated[2]).toBe('filtervalue1');
      });
    });

    describe('and is single value variable for the label part', () => {
      beforeEach(() => {
        const filterTemplateSrv = initTemplateSrv('resource.label.zone');
        const ds = new StackdriverDataSource(instanceSettings, filterTemplateSrv, timeSrv);
        interpolated = ds.interpolateFilters(['${test}', '=~', 'europe-north-1a'], {});
      });

      it('should replace the variable with the value and not with regex formatting', () => {
        expect(interpolated.length).toBe(3);
        expect(interpolated[0]).toBe('resource.label.zone');
      });
    });

    describe('and is multi value variable', () => {
      beforeEach(() => {
        const filterTemplateSrv = initTemplateSrv(['filtervalue1', 'filtervalue2'], true);
        const ds = new StackdriverDataSource(instanceSettings, filterTemplateSrv, timeSrv);
        interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '[[test]]'], {});
      });

      it('should replace the variable with a regex expression', () => {
        expect(interpolated[2]).toBe('(filtervalue1|filtervalue2)');
      });
    });
  });

  describe('when interpolating a template variable for group bys', () => {
    let interpolated: any[];

    describe('and is single value variable', () => {
      beforeEach(() => {
        const groupByTemplateSrv = initTemplateSrv('groupby1');
        const ds = new StackdriverDataSource(instanceSettings, groupByTemplateSrv, timeSrv);
        interpolated = ds.interpolateGroupBys(['[[test]]'], {});
      });

      it('should replace the variable with the value', () => {
        expect(interpolated.length).toBe(1);
        expect(interpolated[0]).toBe('groupby1');
      });
    });

    describe('and is multi value variable', () => {
      beforeEach(() => {
        const groupByTemplateSrv = initTemplateSrv(['groupby1', 'groupby2'], true);
        const ds = new StackdriverDataSource(instanceSettings, groupByTemplateSrv, timeSrv);
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
    let ds: StackdriverDataSource, res: any;
    beforeEach(() => {
      ds = new StackdriverDataSource(instanceSettings, templateSrv, timeSrv);
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
function initTemplateSrv(values: any, multi = false) {
  const templateSrv = new TemplateSrv();
  templateSrv.init([
    new CustomVariable(
      {
        name: 'test',
        current: {
          value: values,
        },
        multi: multi,
      },
      {} as any
    ),
  ]);
  return templateSrv;
}

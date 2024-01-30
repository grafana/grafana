import { DataQueryRequest, DataSourceInstanceSettings, toUtc } from '@grafana/data';
import { getTemplateSrv, TemplateSrv } from '@grafana/runtime'; // will use the version in __mocks__

import CloudMonitoringDataSource from '../datasource';
import { CloudMonitoringQuery } from '../types/query';
import { CloudMonitoringOptions, CustomVariableModel } from '../types/types';

let getTempVars = () => [] as CustomVariableModel[];
let replace = () => '';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: replace,
    getVariables: getTempVars,
    updateTimeRange: jest.fn(),
    containsTemplate: jest.fn(),
  }),
}));

type Args = { response?: unknown; throws?: boolean; templateSrv?: TemplateSrv };

function getTestcontext({ response = {}, throws = false, templateSrv = getTemplateSrv() }: Args = {}) {
  jest.clearAllMocks();

  const instanceSettings = {
    jsonData: {
      defaultProject: 'testproject',
    },
  } as unknown as DataSourceInstanceSettings<CloudMonitoringOptions>;

  const ds = new CloudMonitoringDataSource(instanceSettings, templateSrv);

  return { ds };
}

describe('CloudMonitoringDataSource', () => {
  describe('When performing query', () => {
    describe('and no time series data is returned', () => {
      it('should return a list of datapoints', async () => {
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
        } as DataQueryRequest<CloudMonitoringQuery>;

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

        const { ds } = getTestcontext({ response });

        await expect(ds.query(options)).toEmitValuesWith((received) => {
          const results = received[0];
          expect(results.data.length).toBe(0);
        });
      });
    });
  });

  describe('when interpolating a template variable for the filter', () => {
    beforeEach(() => {
      getTempVars = () => [] as CustomVariableModel[];
      replace = (target?: string) => target || '';
    });
    describe('and is single value variable', () => {
      it('should replace the variable with the value', () => {
        replace = () => 'filtervalue1';
        const { ds } = getTestcontext();
        const interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '${test}'], {});

        expect(interpolated.length).toBe(3);
        expect(interpolated[2]).toBe('filtervalue1');
      });
    });

    describe('and is single value variable for the label part', () => {
      it('should replace the variable with the value and not with regex formatting', () => {
        replace = () => 'resource.label.zone';
        const { ds } = getTestcontext();
        const interpolated = ds.interpolateFilters(['${test}', '=~', 'europe-north-1a'], {});

        expect(interpolated.length).toBe(3);
        expect(interpolated[0]).toBe('resource.label.zone');
      });
    });

    describe('and is multi value variable', () => {
      beforeEach(() => {
        getTempVars = () => [] as CustomVariableModel[];
        replace = (target?: string) => target || '';
      });
      it('should replace the variable with a regex expression', () => {
        replace = () => '(filtervalue1|filtervalue2)';
        const { ds } = getTestcontext();
        const interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '${test}'], {});

        expect(interpolated[2]).toBe('(filtervalue1|filtervalue2)');
      });

      it('should not escape a regex', () => {
        replace = () => '/[a-Z]*.html';
        const { ds } = getTestcontext();
        const interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '${test}'], {});

        expect(interpolated[2]).toBe('/[a-Z]*.html');
      });

      it('should not escape an array of regexes but join them as a regex', () => {
        replace = () => '(/[a-Z]*.html|/foo.html)';
        const { ds } = getTestcontext();
        const interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '${test}'], {});

        expect(interpolated[2]).toBe('(/[a-Z]*.html|/foo.html)');
      });
    });
  });

  describe('when interpolating a template variable for group bys', () => {
    describe('and is single value variable', () => {
      it('should replace the variable with the value', () => {
        replace = () => 'groupby1';
        const { ds } = getTestcontext();
        const interpolated = ds.interpolateGroupBys(['${test}'], {});

        expect(interpolated.length).toBe(1);
        expect(interpolated[0]).toBe('groupby1');
      });
    });

    describe('and is multi value variable', () => {
      it('should replace the variable with an array of group bys', () => {
        replace = () => 'groupby1,groupby2';
        const { ds } = getTestcontext();
        const interpolated = ds.interpolateGroupBys(['${test}'], {});

        expect(interpolated.length).toBe(2);
        expect(interpolated[0]).toBe('groupby1');
        expect(interpolated[1]).toBe('groupby2');
      });
    });
  });
});

import { of, throwError } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { DataSourceInstanceSettings, toUtc } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { initialCustomVariableModelState } from '../../../../features/variables/custom/reducer';
import { CustomVariableModel } from '../../../../features/variables/types';
import CloudMonitoringDataSource from '../datasource';
import { CloudMonitoringOptions } from '../types';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => backendSrv,
}));

type Args = { response?: any; throws?: boolean; templateSrv?: TemplateSrv };

const fetchMock = jest.spyOn(backendSrv, 'fetch');

function getTestcontext({ response = {}, throws = false, templateSrv = new TemplateSrv() }: Args = {}) {
  jest.clearAllMocks();

  const instanceSettings = {
    jsonData: {
      defaultProject: 'testproject',
    },
  } as unknown as DataSourceInstanceSettings<CloudMonitoringOptions>;

  const timeSrv = {
    timeRange: () => ({
      from: toUtc('2017-08-22T20:00:00Z'),
      to: toUtc('2017-08-22T23:59:00Z'),
    }),
  } as TimeSrv;

  throws
    ? fetchMock.mockImplementation(() => throwError(response))
    : fetchMock.mockImplementation(() => of(createFetchResponse(response)));

  const ds = new CloudMonitoringDataSource(instanceSettings, templateSrv, timeSrv);

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
        };

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

        const { ds } = getTestcontext({ response });

        await expect(ds.query(options as any)).toEmitValuesWith((received) => {
          const results = received[0];
          expect(results.data.length).toBe(0);
        });
      });
    });
  });

  describe('When loading labels', () => {
    describe('and no aggregation was specified', () => {
      it('should use default values', async () => {
        const { ds } = getTestcontext();
        await ds.getLabels('cpu', 'a', 'default-proj');

        await expect(fetchMock.mock.calls[0][0].data.queries[0].metricQuery).toMatchObject({
          crossSeriesReducer: 'REDUCE_NONE',
          groupBys: [],
          metricType: 'cpu',
          projectName: 'default-proj',
          view: 'HEADERS',
        });
      });
    });

    describe('and an aggregation was specified', () => {
      it('should use the provided aggregation', async () => {
        const { ds } = getTestcontext();
        await ds.getLabels('sql', 'b', 'default-proj', {
          crossSeriesReducer: 'REDUCE_MEAN',
          groupBys: ['metadata.system_label.name'],
        });

        await expect(fetchMock.mock.calls[0][0].data.queries[0].metricQuery).toMatchObject({
          crossSeriesReducer: 'REDUCE_MEAN',
          groupBys: ['metadata.system_label.name'],
          metricType: 'sql',
          projectName: 'default-proj',
          view: 'HEADERS',
        });
      });
    });
  });

  describe('when interpolating a template variable for the filter', () => {
    describe('and is single value variable', () => {
      it('should replace the variable with the value', () => {
        const templateSrv = initTemplateSrv('filtervalue1');
        const { ds } = getTestcontext({ templateSrv });
        const interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '${test}'], {});

        expect(interpolated.length).toBe(3);
        expect(interpolated[2]).toBe('filtervalue1');
      });
    });

    describe('and is single value variable for the label part', () => {
      it('should replace the variable with the value and not with regex formatting', () => {
        const templateSrv = initTemplateSrv('resource.label.zone');
        const { ds } = getTestcontext({ templateSrv });
        const interpolated = ds.interpolateFilters(['${test}', '=~', 'europe-north-1a'], {});

        expect(interpolated.length).toBe(3);
        expect(interpolated[0]).toBe('resource.label.zone');
      });
    });

    describe('and is multi value variable', () => {
      it('should replace the variable with a regex expression', () => {
        const templateSrv = initTemplateSrv(['filtervalue1', 'filtervalue2'], true);
        const { ds } = getTestcontext({ templateSrv });
        const interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '[[test]]'], {});

        expect(interpolated[2]).toBe('(filtervalue1|filtervalue2)');
      });

      it('should not escape a regex', () => {
        const templateSrv = initTemplateSrv('/[a-Z]*.html', true);
        const { ds } = getTestcontext({ templateSrv });
        const interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '[[test]]'], {});

        expect(interpolated[2]).toBe('/[a-Z]*.html');
      });

      it('should not escape an array of regexes but join them as a regex', () => {
        const templateSrv = initTemplateSrv(['/[a-Z]*.html', '/foo.html'], true);
        const { ds } = getTestcontext({ templateSrv });
        const interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '[[test]]'], {});

        expect(interpolated[2]).toBe('(/[a-Z]*.html|/foo.html)');
      });
    });
  });

  describe('when interpolating a template variable for group bys', () => {
    describe('and is single value variable', () => {
      it('should replace the variable with the value', () => {
        const templateSrv = initTemplateSrv('groupby1');
        const { ds } = getTestcontext({ templateSrv });
        const interpolated = ds.interpolateGroupBys(['[[test]]'], {});

        expect(interpolated.length).toBe(1);
        expect(interpolated[0]).toBe('groupby1');
      });
    });

    describe('and is multi value variable', () => {
      it('should replace the variable with an array of group bys', () => {
        const templateSrv = initTemplateSrv(['groupby1', 'groupby2'], true);
        const { ds } = getTestcontext({ templateSrv });
        const interpolated = ds.interpolateGroupBys(['[[test]]'], {});

        expect(interpolated.length).toBe(2);
        expect(interpolated[0]).toBe('groupby1');
        expect(interpolated[1]).toBe('groupby2');
      });
    });
  });
});

function initTemplateSrv(values: any, multi = false) {
  const templateSrv = new TemplateSrv();
  const test: CustomVariableModel = {
    ...initialCustomVariableModelState,
    id: 'test',
    name: 'test',
    current: { value: values, text: Array.isArray(values) ? values.toString() : values, selected: true },
    options: [{ value: values, text: Array.isArray(values) ? values.toString() : values, selected: false }],
    multi,
  };
  templateSrv.init([test]);
  return templateSrv;
}

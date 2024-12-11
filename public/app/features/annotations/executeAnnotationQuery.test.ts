import { DataSourceApi, dateTime, DataQuery } from '@grafana/data';

import { PanelModel } from '../dashboard/state/PanelModel';
import { createDashboardModelFixture } from '../dashboard/state/__fixtures__/dashboardFixtures';
import { TestQuery, getMockDataSource } from '../query/state/__mocks__/mockDataSource';

import { executeAnnotationQuery } from './executeAnnotationQuery';
import { AnnotationQueryOptions } from './types';

describe('executeAnnotationQuery', () => {
  let filterQuerySpy: jest.SpyInstance;
  let querySpy: jest.SpyInstance;
  let ds: DataSourceApi;

  const setup = ({ query, filterQuery }: { query: TestQuery; filterQuery?: typeof ds.filterQuery }) => {
    const options: AnnotationQueryOptions = {
      range: { from: dateTime(), to: dateTime(), raw: { from: '1h', to: 'now' } },
      dashboard: createDashboardModelFixture({
        panels: [{ id: 1, type: 'graph' }],
      }),
      panel: {} as PanelModel,
    };

    const ds = getMockDataSource();
    if (filterQuery) {
      ds.filterQuery = filterQuery;
      filterQuerySpy = jest.spyOn(ds, 'filterQuery');
    }
    querySpy = jest.spyOn(ds, 'query');
    executeAnnotationQuery(options, ds, {
      name: '',
      enable: false,
      iconColor: '',
      target: query,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should not call query method in case query is filtered out', async () => {
    setup({
      query: { q: 'SUM(foo)', refId: 'A' },
      filterQuery: (query: TestQuery) => query.q !== 'SUM(foo)',
    });
    expect(filterQuerySpy).toHaveBeenCalledTimes(1);
    expect(querySpy).not.toHaveBeenCalled();
  });

  it('Should call backend in case query is not filtered out', async () => {
    setup({
      filterQuery: (_: DataQuery) => true,
      query: { q: 'SUM(foo)', refId: 'A' },
    });
    expect(filterQuerySpy).toHaveBeenCalledTimes(1);
    expect(querySpy).toHaveBeenCalledTimes(1);
  });
});

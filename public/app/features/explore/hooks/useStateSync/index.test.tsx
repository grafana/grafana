import { act, waitFor, renderHook } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { stringify } from 'querystring';
import { ReactNode } from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { DataQuery, DataSourceApi, UrlQueryMap } from '@grafana/data';
import { HistoryWrapper, setDataSourceSrv, DataSourceSrv } from '@grafana/runtime';
import { setLastUsedDatasourceUID } from 'app/core/utils/explore';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { configureStore } from 'app/store/configureStore';

import { makeDatasourceSetup } from '../../spec/helper/setup';
import { splitClose, splitOpen } from '../../state/main';

import { useStateSync } from './';

const fetch = jest.fn().mockResolvedValue({ correlations: [] });
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ fetch }),
}));

jest.mock('rxjs', () => ({
  ...jest.requireActual('rxjs'),
  lastValueFrom: () =>
    new Promise((resolve, reject) => {
      resolve({ data: { correlations: [] } });
    }),
}));

function defaultDsGetter(datasources: Array<ReturnType<typeof makeDatasourceSetup>>): DataSourceSrv['get'] {
  return (datasource) => {
    let ds;
    if (!datasource) {
      ds = datasources[0]?.api;
    } else {
      ds = datasources.find((ds) =>
        typeof datasource === 'string'
          ? ds.api.name === datasource || ds.api.uid === datasource
          : ds.api.uid === datasource?.uid
      )?.api;
    }

    if (ds) {
      return Promise.resolve(ds);
    }

    return Promise.reject();
  };
}

interface SetupParams {
  queryParams?: UrlQueryMap;
  datasourceGetter?: (datasources: Array<ReturnType<typeof makeDatasourceSetup>>) => DataSourceSrv['get'];
}
function setup({ queryParams = {}, datasourceGetter = defaultDsGetter }: SetupParams) {
  const history = createMemoryHistory({
    initialEntries: [{ pathname: '/explore', search: stringify(queryParams) }],
  });

  const location = new HistoryWrapper(history);

  const datasources = [
    makeDatasourceSetup({ name: 'loki', uid: 'loki-uid' }),
    makeDatasourceSetup({ name: 'elastic', uid: 'elastic-uid' }),
    makeDatasourceSetup({ name: MIXED_DATASOURCE_NAME, uid: MIXED_DATASOURCE_NAME, id: 999 }),
  ];

  setDataSourceSrv({
    get: datasourceGetter(datasources),
    getInstanceSettings: jest.fn(),
    getList: jest.fn(),
    reload: jest.fn(),
  });

  const store = configureStore({
    user: {
      orgId: 1,
      fiscalYearStartMonth: 0,
      isUpdating: false,
      orgs: [],
      orgsAreLoading: false,
      sessions: [],
      sessionsAreLoading: false,
      teams: [],
      teamsAreLoading: false,
      timeZone: 'utc',
      user: null,
      weekStart: 'monday',
    },
  });

  const context = getGrafanaContextMock();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestProvider
      grafanaContext={{
        ...context,
        location,
      }}
      store={store}
    >
      {children}
    </TestProvider>
  );

  return {
    ...renderHook(({ params }) => useStateSync(params), {
      wrapper,
      initialProps: {
        children: null,
        params: queryParams,
      },
    }),
    location,
    store,
  };
}

describe('useStateSync', () => {
  it('does not push a new entry to history on first render', async () => {
    const { location } = setup({});

    const initialHistoryLength = location.getHistory().length;

    await waitFor(() => {
      expect(location.getHistory().length).toBe(initialHistoryLength);
      const search = location.getSearchObject();
      expect(search.panes).toBeDefined();
    });
  });

  it('correctly inits an explore pane for each key in the panes search object', async () => {
    const { location, store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: {
            datasource: 'loki-uid',
            queries: [
              { datasource: { name: 'loki', uid: 'loki-uid' }, refId: '1+2' },
              { datasource: 'loki-uid', refId: '3' },
              { datasource: 'loki', refId: '4' },
            ],
          },
          two: { datasource: 'elastic-uid', queries: [{ datasource: { name: 'elastic', uid: 'elastic-uid' } }] },
        }),
        schemaVersion: 1,
      },
      datasourceGetter: (datasources: Array<ReturnType<typeof makeDatasourceSetup>>): DataSourceSrv['get'] => {
        return (datasource) => {
          let ds: DataSourceApi | undefined;
          if (!datasource) {
            ds = datasources[0]?.api;
          } else {
            ds = datasources.find((ds) =>
              typeof datasource === 'string'
                ? ds.api.name === datasource || ds.api.uid === datasource
                : ds.api.uid === datasource?.uid
            )?.api;
          }

          return new Promise((resolve, reject) => {
            if (ds) {
              if (typeof datasource === 'string' && datasource === 'loki-uid') {
                setTimeout(() => Promise.resolve(ds));
              } else {
                resolve(ds);
              }
            }

            reject();
          });
        };
      },
    });

    const initialHistoryLength = location.getHistory().length;

    // await waitForNextUpdate();
    await waitFor(() => {
      expect(location.getHistory().length).toBe(initialHistoryLength);

      const panes = location.getSearch().get('panes');
      expect(panes).not.toBeNull();
      if (panes) {
        // check if the URL is properly encoded when finishing rendering the hook. (this would be '1 2' otherwise)
        expect(JSON.parse(panes)['one'].queries[0].refId).toBe('1+2');
        expect(JSON.parse(panes)['one'].queries[0].datasource?.uid).toBe('loki-uid');

        // we expect panes in the state to be in the same order as the ones in the URL
        expect(Object.keys(store.getState().explore.panes)).toStrictEqual(Object.keys(JSON.parse(panes)));

        // check that the datasources for the queries resolved correctly when set to a name or uid
        expect(JSON.parse(panes)['one'].queries[1].refId).toBe('3');
        expect(JSON.parse(panes)['one'].queries[1].datasource?.uid).toBe('loki-uid');
        expect(JSON.parse(panes)['one'].queries[2].refId).toBe('4');
        expect(JSON.parse(panes)['one'].queries[2].datasource?.uid).toBe('loki-uid');
      }
    });
  });

  it('inits with a default query from the root level datasource when there are no valid queries in the URL', async () => {
    const { location, store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ datasource: { name: 'UNKNOWN', uid: 'UNKNOWN-DS' } }] },
        }),
        schemaVersion: 1,
      },
    });

    const initialHistoryLength = location.getHistory().length;

    await waitFor(() => {
      expect(location.getHistory().length).toBe(initialHistoryLength);

      const search = location.getSearchObject();
      expect(search.panes).toBeDefined();

      const queries = store.getState().explore.panes['one']?.queries;
      expect(queries).toHaveLength(1);

      expect(queries?.[0].datasource?.uid).toBe('loki-uid');
    });
  });

  it('inits with mixed datasource if there are multiple datasources in queries and no root level datasource is defined', async () => {
    const { location, store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: {
            queries: [
              { datasource: { name: 'loki', uid: 'loki-uid' } },
              { datasource: { name: 'elastic', uid: 'elastic-uid' } },
            ],
          },
        }),
        schemaVersion: 1,
      },
    });

    const initialHistoryLength = location.getHistory().length;

    await waitFor(() => {
      expect(location.getHistory().length).toBe(initialHistoryLength);

      const search = location.getSearchObject();
      expect(search.panes).toBeDefined();

      const paneState = store.getState().explore.panes['one'];
      expect(paneState?.datasourceInstance?.name).toBe(MIXED_DATASOURCE_NAME);

      expect(paneState?.queries).toHaveLength(2);
      expect(paneState?.queries?.[0].datasource?.uid).toBe('loki-uid');
      expect(paneState?.queries?.[1].datasource?.uid).toBe('elastic-uid');
    });
  });

  it("inits with a query's datasource if there are multiple datasources in queries, no root level datasource, and only one query has a valid datsource", async () => {
    const { location, store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: {
            queries: [
              { datasource: { name: 'loki', uid: 'loki-uid' } },
              { datasource: { name: 'UNKNOWN', uid: 'UNKNOWN-UID' } },
            ],
          },
        }),
        schemaVersion: 1,
      },
    });

    const initialHistoryLength = location.getHistory().length;

    await waitFor(() => {
      expect(location.getHistory().length).toBe(initialHistoryLength);

      const search = location.getSearchObject();
      expect(search.panes).toBeDefined();

      const paneState = store.getState().explore.panes['one'];
      expect(paneState?.datasourceInstance?.getRef().uid).toBe('loki-uid');

      expect(paneState?.queries).toHaveLength(1);
      expect(paneState?.queries?.[0].datasource?.uid).toBe('loki-uid');
    });
  });

  it('inits with the last used datasource from localStorage', async () => {
    setLastUsedDatasourceUID(1, 'elastic-uid');
    const { store } = setup({
      queryParams: {},
    });

    await waitFor(() => {
      expect(Object.values(store.getState().explore.panes)[0]?.datasourceInstance?.uid).toBe('elastic-uid');
    });
  });

  it('inits with the default datasource if the last used in localStorage does not exits', async () => {
    setLastUsedDatasourceUID(1, 'unknown-ds-uid');
    const { store } = setup({
      queryParams: {},
    });

    await waitFor(() => {
      expect(Object.values(store.getState().explore.panes)[0]?.datasourceInstance?.uid).toBe('loki-uid');
    });
  });

  it('updates the state with correct queries from URL', async () => {
    const { rerender, store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ expr: 'a' }] },
        }),
        schemaVersion: 1,
      },
    });

    let queries: DataQuery[] | undefined;
    await waitFor(() => {
      queries = store.getState().explore.panes['one']?.queries;
      expect(queries).toHaveLength(1);
      expect(queries?.[0]).toMatchObject({ expr: 'a' });
    });

    rerender({
      children: null,
      params: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ expr: 'a' }, { expr: 'b' }] },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      queries = store.getState().explore.panes['one']?.queries;
      expect(queries).toHaveLength(2);
      expect(queries?.[0]).toMatchObject({ expr: 'a' });
      expect(queries?.[1]).toMatchObject({ expr: 'b' });
    });

    rerender({
      children: null,
      params: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ expr: 'a' }] },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      queries = store.getState().explore.panes['one']?.queries;
      expect(queries).toHaveLength(1);
      expect(queries?.[0]).toMatchObject({ expr: 'a' });
    });
  });

  it('Opens and closes the split pane if an a new pane is added or removed in the URL', async () => {
    const { rerender, store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ expr: 'a' }] },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      let panes = Object.keys(store.getState().explore.panes);
      expect(panes).toHaveLength(1);
    });

    rerender({
      children: null,
      params: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ expr: 'a' }, { expr: 'b' }] },
          two: { datasource: 'loki-uid', queries: [{ expr: 'a' }, { expr: 'b' }] },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(Object.keys(store.getState().explore.panes)).toHaveLength(2);
    });

    rerender({
      children: null,
      params: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ expr: 'a' }] },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(Object.keys(store.getState().explore.panes)).toHaveLength(1);
    });
  });

  it('Changes datasource when the datasource in the URL is updated', async () => {
    const { rerender, store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ expr: 'a' }] },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(store.getState().explore.panes['one']?.datasourceInstance?.getRef()).toMatchObject({
        type: 'logs',
        uid: 'loki-uid',
      });
    });

    rerender({
      children: null,
      params: {
        panes: JSON.stringify({
          one: { datasource: 'elastic-uid', queries: [{ expr: 'a' }, { expr: 'b' }] },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(store.getState().explore.panes['one']?.datasourceInstance?.getRef()).toMatchObject({
        type: 'logs',
        uid: 'elastic-uid',
      });
    });
  });

  it('Changes time rage when the range in the URL is updated', async () => {
    const { rerender, store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ expr: 'a' }], range: { from: 'now-1h', to: 'now' } },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(store.getState().explore.panes['one']?.range.raw).toMatchObject({ from: 'now-1h', to: 'now' });
    });

    rerender({
      children: null,
      params: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ expr: 'a' }], range: { from: 'now-6h', to: 'now' } },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(store.getState().explore.panes['one']?.range.raw).toMatchObject({ from: 'now-6h', to: 'now' });
    });
  });

  it('Changes time range when the range in the URL is updated to absolute range', async () => {
    const { rerender, store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: { datasource: 'loki-uid', queries: [{ expr: 'a' }], range: { from: 'now-1h', to: 'now' } },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(store.getState().explore.panes['one']?.range.raw).toMatchObject({ from: 'now-1h', to: 'now' });
    });

    rerender({
      children: null,
      params: {
        panes: JSON.stringify({
          one: {
            datasource: 'loki-uid',
            queries: [{ expr: 'a' }],
            range: { from: '1500000000000', to: '1500000001000' },
          },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(store.getState().explore.panes['one']?.range.raw.from.valueOf().toString()).toEqual('1500000000000');
      expect(store.getState().explore.panes['one']?.range.raw.to.valueOf().toString()).toEqual('1500000001000');
    });
  });

  it('uses the first query datasource if no root datasource is specified in the URL', async () => {
    const { store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: {
            queries: [{ expr: 'b', datasource: { uid: 'loki-uid', type: 'logs' }, refId: 'B' }],
          },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(store.getState().explore.panes['one']?.datasourceInstance?.getRef()).toMatchObject({
        uid: 'loki-uid',
        type: 'logs',
      });
    });
  });

  it('updates the URL opening and closing a pane datasource changes', async () => {
    const { store, location } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: {
            datasource: 'loki-uid',
            queries: [{ expr: 'a', datasource: { uid: 'loki-uid', type: 'logs' }, refId: 'A' }],
          },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(location.getHistory().length).toBe(1);

      expect(store.getState().explore.panes['one']?.datasourceInstance?.uid).toBe('loki-uid');
    });

    act(() => {
      store.dispatch(splitOpen());
    });

    await waitFor(() => {
      expect(location.getHistory().length).toBe(2);
      expect(Object.keys(store.getState().explore.panes)).toHaveLength(2);
    });

    act(() => {
      store.dispatch(splitClose('one'));
    });

    await waitFor(async () => {
      expect(location.getHistory()).toHaveLength(3);
    });
  });

  it('filters out queries from the URL that do not have a datasource', async () => {
    const { store } = setup({
      queryParams: {
        panes: JSON.stringify({
          one: {
            datasource: MIXED_DATASOURCE_NAME,
            queries: [
              { expr: 'a', refId: 'A' },
              { expr: 'b', datasource: { uid: 'loki-uid', type: 'logs' }, refId: 'B' },
            ],
          },
        }),
        schemaVersion: 1,
      },
    });

    await waitFor(() => {
      expect(store.getState().explore.panes['one']?.queries.length).toBe(1);
      expect(store.getState().explore.panes['one']?.queries[0]).toMatchObject({ expr: 'b', refId: 'B' });
    });
  });
});

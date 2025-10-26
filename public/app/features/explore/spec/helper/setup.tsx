import { ByRoleMatcher, waitFor, within } from '@testing-library/dom';
import { render, screen } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { KBarProvider } from 'kbar';
import { fromPairs } from 'lodash';
import { stringify } from 'querystring';
import { ComponentType, ReactNode } from 'react';
import { Provider } from 'react-redux';
// eslint-disable-next-line no-restricted-imports
import { Route, Router } from 'react-router-dom';
import { of } from 'rxjs';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import {
  DataSourceApi,
  DataSourceInstanceSettings,
  QueryEditorProps,
  DataSourcePluginMeta,
  PluginType,
} from '@grafana/data';
import {
  setDataSourceSrv,
  setEchoSrv,
  locationService,
  HistoryWrapper,
  LocationService,
  setBackendSrv,
  getBackendSrv,
  getDataSourceSrv,
  getEchoSrv,
  setLocationService,
  setPluginLinksHook,
} from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { AppChrome } from 'app/core/components/AppChrome/AppChrome';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { Echo } from 'app/core/services/echo/Echo';
import { setLastUsedDatasourceUID } from 'app/core/utils/explore';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { configureStore } from 'app/store/configureStore';
import { ExploreQueryParams } from 'app/types/explore';

import { RichHistoryRemoteStorageDTO } from '../../../../core/history/RichHistoryRemoteStorage';
import { LokiDatasource } from '../../../../plugins/datasource/loki/datasource';
import { LokiQuery } from '../../../../plugins/datasource/loki/types';
import { initialUserState } from '../../../profile/state/reducers';
import ExplorePage from '../../ExplorePage';
import { QueriesDrawerContextProvider } from '../../QueriesDrawer/QueriesDrawerContext';

import { mockData } from './mocks';

export const QueryLibraryMocks = {
  data: mockData.all,
};

export const IdentityServiceMocks = {
  data: mockData.identityDisplay,
};

type DatasourceSetup = { settings: DataSourceInstanceSettings; api: DataSourceApi };

type SetupOptions = {
  clearLocalStorage?: boolean;
  datasources?: DatasourceSetup[];
  queryHistory?: { queryHistory: Array<Partial<RichHistoryRemoteStorageDTO>>; totalCount: number };
  urlParams?: ExploreQueryParams;
  prevUsedDatasource?: { orgId: number; datasource: string };
  failAddToLibrary?: boolean;
  // Use AppChrome wrapper around ExplorePage - needed to test query library/history
  withAppChrome?: boolean;
  provider?: ComponentType<{ children: ReactNode }>;
};

type TearDownOptions = {
  clearLocalStorage?: boolean;
};

export function setupExplore(options?: SetupOptions): {
  datasources: { [uid: string]: DataSourceApi };
  store: ReturnType<typeof configureStore>;
  unmount: () => void;
  container: HTMLElement;
  location: LocationService;
} {
  const previousBackendSrv = getBackendSrv();
  setBackendSrv({
    datasourceRequest: jest.fn().mockRejectedValue(undefined),
    delete: jest.fn().mockRejectedValue(undefined),
    chunked: jest.fn().mockRejectedValue(undefined),
    fetch: jest.fn().mockImplementation((req) => {
      let data: Record<string, string | object | number> = {};
      if (req.url.startsWith('/api/datasources/correlations') && req.method === 'GET') {
        data.correlations = [];
        data.totalCount = 0;
      } else if (req.url.startsWith('/api/query-history') && req.method === 'GET') {
        data.result = options?.queryHistory || {};
      } else if (req.url.startsWith(QueryLibraryMocks.data.url)) {
        data = QueryLibraryMocks.data.response;
      }
      return of({ data });
    }),
    get: jest.fn().mockResolvedValue(IdentityServiceMocks.data.response),
    patch: jest.fn().mockRejectedValue(undefined),
    post: jest.fn(),
    put: jest.fn().mockRejectedValue(undefined),
    request: jest.fn().mockRejectedValue(undefined),
  });

  setPluginLinksHook(() => ({ links: [], isLoading: false }));

  // Clear this up otherwise it persists data source selection
  // TODO: probably add test for that too
  if (options?.clearLocalStorage !== false) {
    window.localStorage.clear();
  }

  if (options?.prevUsedDatasource) {
    setLastUsedDatasourceUID(options?.prevUsedDatasource.orgId, options?.prevUsedDatasource.datasource);
  }

  // Create this here so any mocks are recreated on setup and don't retain state
  const defaultDatasources: DatasourceSetup[] = [
    makeDatasourceSetup(),
    makeDatasourceSetup({ name: 'elastic', id: 2 }),
    makeDatasourceSetup({ name: MIXED_DATASOURCE_NAME, uid: MIXED_DATASOURCE_NAME, id: 999 }),
  ];

  const dsSettings = options?.datasources || defaultDatasources;

  const previousDataSourceSrv = getDataSourceSrv();

  setDataSourceSrv({
    registerRuntimeDataSource: jest.fn(),
    getList(): DataSourceInstanceSettings[] {
      return dsSettings.map((d) => d.settings);
    },
    getInstanceSettings(ref?: DataSourceRef) {
      const allSettings = dsSettings.map((d) => d.settings);
      return allSettings.find((x) => x.name === ref || x.uid === ref || x.uid === ref?.uid) || allSettings[0];
    },
    get(datasource?: string | DataSourceRef | null): Promise<DataSourceApi> {
      let ds: DataSourceApi | undefined;
      if (!datasource) {
        ds = dsSettings[0]?.api;
      } else {
        ds = dsSettings.find((ds) =>
          typeof datasource === 'string'
            ? ds.api.name === datasource || ds.api.uid === datasource
            : ds.api.uid === datasource?.uid
        )?.api;
      }

      if (ds) {
        return Promise.resolve(ds);
      }

      return Promise.reject();
    },
    reload() {},
  });

  const previousEchoSrv = getEchoSrv();
  setEchoSrv(new Echo());

  const storeState = configureStore();
  storeState.getState().user = {
    ...initialUserState,
    orgId: 1,
    timeZone: 'utc',
  };

  storeState.getState().navIndex = {
    explore: {
      id: 'explore',
      text: 'Explore',
      subTitle: 'Explore your data',
      icon: 'compass',
      url: '/explore',
    },
  };

  const history = createMemoryHistory({
    initialEntries: [{ pathname: '/explore', search: stringify(options?.urlParams) }],
  });

  const location = new HistoryWrapper(history);
  setLocationService(location);

  const contextMock = getGrafanaContextMock({ location });

  const FinalProvider =
    options?.provider ||
    (({ children }) => {
      return children;
    });

  const { unmount, container } = render(
    <Provider store={storeState}>
      <GrafanaContext.Provider value={contextMock}>
        <Router history={history}>
          <QueriesDrawerContextProvider>
            <FinalProvider>
              {options?.withAppChrome ? (
                <KBarProvider>
                  <AppChrome>
                    <Route
                      path="/explore"
                      exact
                      render={(props) => (
                        <GrafanaRoute {...props} route={{ component: ExplorePage, path: '/explore' }} />
                      )}
                    />
                  </AppChrome>
                </KBarProvider>
              ) : (
                <Route
                  path="/explore"
                  exact
                  render={(props) => <GrafanaRoute {...props} route={{ component: ExplorePage, path: '/explore' }} />}
                />
              )}
            </FinalProvider>
          </QueriesDrawerContextProvider>
        </Router>
      </GrafanaContext.Provider>
    </Provider>
  );

  exploreTestsHelper.tearDownExplore = (options?: TearDownOptions) => {
    setDataSourceSrv(previousDataSourceSrv);
    setEchoSrv(previousEchoSrv);
    setBackendSrv(previousBackendSrv);
    setLocationService(locationService);
    if (options?.clearLocalStorage !== false) {
      window.localStorage.clear();
    }
  };

  return {
    datasources: fromPairs(dsSettings.map((d) => [d.api.name, d.api])),
    store: storeState,
    unmount,
    container,
    location,
  };
}

export function makeDatasourceSetup({
  name = 'loki',
  id = 1,
  uid: uidOverride,
}: { name?: string; id?: number; uid?: string } = {}): DatasourceSetup {
  const uid = uidOverride || `${name}-uid`;
  const type = 'logs';

  const meta: DataSourcePluginMeta = {
    info: {
      author: {
        name: 'Grafana',
      },
      description: '',
      links: [],
      screenshots: [],
      updated: '',
      version: '',
      logos: {
        small: '',
        large: '',
      },
    },
    id: id.toString(),
    module: 'loki',
    name,
    type: PluginType.datasource,
    baseUrl: '',
  };
  return {
    settings: {
      id,
      uid,
      type,
      name,
      meta,
      access: 'proxy',
      jsonData: {},
      readOnly: false,
    },
    api: {
      components: {
        QueryEditor(props: QueryEditorProps<LokiDatasource, LokiQuery>) {
          return (
            <div>
              <input
                aria-label="query"
                defaultValue={props.query.expr}
                onChange={(event) => {
                  props.onChange({ ...props.query, expr: event.target.value });
                }}
              />
              {name} Editor input: {props.query.expr}
            </div>
          );
        },
      },
      name: name,
      uid: uid,
      query: jest.fn(),
      getRef: () => ({ type, uid }),
      meta,
    } as any,
  };
}

export const waitForExplore = (exploreId = 'left') => {
  return waitFor(async () => {
    const container = screen.getAllByTestId('data-testid Explore');
    return within(container[exploreId === 'left' ? 0 : 1]);
  });
};

export const tearDown = (options?: TearDownOptions) => {
  exploreTestsHelper.tearDownExplore?.(options);
};

export const withinExplore = (exploreId: string) => {
  const container = screen.getAllByTestId('data-testid Explore');
  return within(container[exploreId === 'left' ? 0 : 1]);
};

export const withinQueryHistory = () => {
  const container = screen.getByTestId('data-testid QueryHistory');
  return within(container);
};

export const withinQueryLibrary = () => {
  const container = screen.getByRole('dialog', { name: /Drawer title/ });
  within(container).getByText('Query library');
  return within(container);
};

const exploreTestsHelper: { setupExplore: typeof setupExplore; tearDownExplore?: (options?: TearDownOptions) => void } =
  {
    setupExplore,
    tearDownExplore: undefined,
  };

/**
 * Optimized version of getAllByRole to avoid timeouts in tests. Please check #70158, #59116 and #47635, #78236.
 */
export const getAllByRoleInQueryHistoryTab = (role: ByRoleMatcher, name: string | RegExp) => {
  const selector = withinQueryHistory();
  // Test ID is used to avoid test timeouts reported in
  const queriesContainer = selector.getByTestId('query-history-queries-tab');
  return within(queriesContainer).getAllByRole(role, { name });
};

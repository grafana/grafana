import { RenderResult, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';

import { LayoutModes, PluginType } from '@grafana/data';
import { setPluginLinksHook, setPluginComponentsHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import * as api from 'app/features/datasources/api';
import { getMockDataSources } from 'app/features/datasources/mocks/dataSourcesMocks';
import { configureStore } from 'app/store/configureStore';

import { getPluginsStateMock } from '../../../plugins/admin/mocks/mockHelpers';
import Connections from '../../Connections';
import { ROUTES } from '../../constants';
import { navIndex } from '../../mocks/store.navIndex.mock';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

const mockDatasources = getMockDataSources(3);

const renderPage = (
  path: string = ROUTES.Base,
  store = configureStore({
    navIndex,
    plugins: getPluginsStateMock([]),
    dataSources: {
      dataSources: mockDatasources,
      dataSourcesCount: mockDatasources.length,
      isLoadingDataSources: false,
      searchQuery: '',
      dataSourceTypeSearchQuery: '',
      layoutMode: LayoutModes.List,
      dataSource: mockDatasources[0],
      dataSourceMeta: {
        id: '',
        name: '',
        type: PluginType.panel,
        info: {
          author: {
            name: '',
            url: undefined,
          },
          description: '',
          links: [],
          logos: {
            large: '',
            small: '',
          },
          screenshots: [],
          updated: '',
          version: '',
        },
        module: '',
        baseUrl: '',
        backend: true,
        isBackend: true,
      },
      isLoadingDataSourcePlugins: false,
      plugins: [],
      categories: [],
      isSortAscending: true,
    },
  })
): RenderResult => {
  return render(
    <Routes>
      <Route path={`${ROUTES.Base}/*`} element={<Connections />} />
    </Routes>,
    {
      store,
      historyOptions: { initialEntries: [path] },
    }
  );
};

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    config: {
      ...original.config,
      bootData: {
        user: {
          orgId: 1,
          timezone: 'UTC',
        },
        navTree: [],
      },
      featureToggles: {
        ...original.config.featureToggles,
      },
      datasources: {},
      defaultDatasource: '',
      buildInfo: {
        ...original.config.buildInfo,
        edition: 'Open Source',
      },
      caching: {
        ...original.config.caching,
        enabled: true,
      },
    },
    getTemplateSrv: () => ({
      replace: (str: string) => str,
    }),
    getDataSourceSrv: () => {
      return {
        getInstanceSettings: (uid: string) => {
          return {
            id: uid,
            uid: uid,
            type: PluginType.datasource,
            name: uid,
            meta: {
              id: uid,
              name: uid,
              type: PluginType.datasource,
              backend: true,
              isBackend: true,
            },
          };
        },
      };
    },
  };
});

describe('DataSourceEditTabs', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    (api.getDataSources as jest.Mock) = jest.fn().mockResolvedValue(mockDatasources);
    (contextSrv.hasPermission as jest.Mock) = jest.fn().mockReturnValue(true);
  });

  it('should render Permissions and Insights tabs', () => {
    const path = ROUTES.DataSourcesEdit.replace(':uid', mockDatasources[0].uid);
    renderPage(path);

    const permissionsTab = screen.getByTestId('data-testid Tab Permissions');
    expect(permissionsTab).toBeInTheDocument();
    expect(permissionsTab).toHaveTextContent('Permissions');
    expect(permissionsTab).toHaveAttribute('href', '/connections/datasources/edit/x/permissions');

    const insightsTab = screen.getByTestId('data-testid Tab Insights');
    expect(insightsTab).toBeInTheDocument();
    expect(insightsTab).toHaveTextContent('Insights');
    expect(insightsTab).toHaveAttribute('href', '/connections/datasources/edit/x/insights');
  });
});

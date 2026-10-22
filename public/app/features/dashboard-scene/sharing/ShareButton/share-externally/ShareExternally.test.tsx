import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { render } from 'test/test-utils';

import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { type BackendSrv, getBackendSrv, setBackendSrv, setPluginImportUtils } from '@grafana/runtime';
import {
  CustomVariable,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';
import { configureStore } from 'app/store/configureStore';
import { AppNotificationSeverity } from 'app/types/appNotifications';

import { contextSrv } from '../../../../../core/services/context_srv';
import { DashboardScene } from '../../../scene/DashboardScene';
import { type DashboardSceneState } from '../../../scene/types/dashboard';
import { activateFullSceneTree } from '../../../utils/test-utils';
import { ShareDrawer } from '../../ShareDrawer/ShareDrawer';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
const shareExternallySelector = e2eSelectors.pages.ShareDashboardDrawer.ShareExternally;

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

beforeEach(() => {
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  jest.spyOn(contextSrv, 'hasRole').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Alerts', () => {
  it('when share type is public, warning is shown', async () => {
    await buildAndRenderScenario({});
    expect(screen.queryByTestId(shareExternallySelector.publicAlert)).toBeInTheDocument();
    expect(screen.queryByTestId(shareExternallySelector.emailSharingAlert)).not.toBeInTheDocument();
  });
  it('when user has no write permissions, warning is shown', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    await buildAndRenderScenario({});
    expect(screen.queryByTestId(selectors.NoUpsertPermissionsWarningAlert)).toBeInTheDocument();
  });
  it('when dashboard has template variables, warning is shown', async () => {
    await buildAndRenderScenario({
      overrides: {
        $variables: new SceneVariableSet({
          variables: [
            new CustomVariable({ name: 'custom', query: 'A,B,C', value: ['A', 'B', 'C'], text: ['A', 'B', 'C'] }),
          ],
        }),
      },
    });
    expect(screen.queryByTestId(selectors.TemplateVariablesWarningAlert)).toBeInTheDocument();
  });

  it('when dashboard has unsupported datasources, warning is shown', async () => {
    await buildAndRenderScenario({
      panelOverrides: {
        $data: new SceneQueryRunner({
          data: {
            state: LoadingState.Done,
            series: [],
            timeRange: getDefaultTimeRange(),
          },
          datasource: { uid: 'my-uid' },
          queries: [{ query: 'QueryA', refId: 'A' }],
        }),
      },
    });
    expect(await screen.findByTestId(selectors.UnsupportedDataSourcesWarningAlert)).toBeInTheDocument();
  });
});

describe('Public dashboard request', () => {
  const server = setupMockServer();
  let previousBackendSrv: BackendSrv;

  beforeAll(() => {
    previousBackendSrv = getBackendSrv();
    setBackendSrv(backendSrv);
  });

  afterAll(() => {
    setBackendSrv(previousBackendSrv);
  });

  it('shows an error notification when the request fails', async () => {
    server.use(
      http.get('/api/dashboards/uid/dash-1/public-dashboards', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 })
      )
    );
    const store = configureStore();

    await buildAndRenderScenario({ store });

    await waitFor(() =>
      expect(Object.values(store.getState().appNotifications.byId)).toEqual([
        expect.objectContaining({ severity: AppNotificationSeverity.Error, title: 'Server error' }),
      ])
    );
  });

  it('shows no notification when the dashboard has no public dashboard', async () => {
    server.use(http.get('/api/dashboards/uid/dash-1/public-dashboards', () => notFoundResponse()));
    const store = configureStore();

    await buildAndRenderScenario({ store });

    await waitFor(() => expect(getLookup(store).isSuccess).toBe(true));
    expect(Object.values(store.getState().appNotifications.byId)).toEqual([]);
  });

  it('does not show an earlier failure once its own request succeeds', async () => {
    let requests = 0;
    server.use(
      http.get('/api/dashboards/uid/dash-1/public-dashboards', () => {
        requests++;
        return requests === 1 ? HttpResponse.json({ message: 'Server error' }, { status: 500 }) : notFoundResponse();
      })
    );
    const store = configureStore();
    // The toolbar badge's failed lookup is still in the cache when the drawer opens.
    await store.dispatch(publicDashboardApi.endpoints.getPublicDashboard.initiate('dash-1'));

    await buildAndRenderScenario({ store });

    await waitFor(() => expect(getLookup(store).isSuccess).toBe(true));
    expect(requests).toBe(2);
    expect(Object.values(store.getState().appNotifications.byId)).toEqual([]);
  });
});

function notFoundResponse() {
  return HttpResponse.json({ message: 'Dashboard not found', messageId: 'publicdashboards.notFound' }, { status: 404 });
}

function getLookup(store: ReturnType<typeof configureStore>) {
  return publicDashboardApi.endpoints.getPublicDashboard.select('dash-1')(store.getState());
}

async function buildAndRenderScenario({
  overrides,
  panelOverrides,
  store,
}: {
  overrides?: Partial<DashboardSceneState>;
  panelOverrides?: Partial<VizPanelState>;
  store?: ReturnType<typeof configureStore>;
}) {
  const drawer = new ShareDrawer({ shareView: shareDashboardType.publicDashboard });

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    $timeRange: new SceneTimeRange({}),
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({
        title: 'Panel A',
        pluginId: 'table',
        key: 'panel-12',
        ...panelOverrides,
      }),
    ]),
    overlay: drawer,
    ...overrides,
  });

  activateFullSceneTree(scene);

  render(<drawer.Component model={drawer} />, { store });

  await screen.findByTestId(shareExternallySelector.container);

  return drawer.Component;
}

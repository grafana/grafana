import { screen, waitForElementToBeRemoved } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, setPluginImportUtils } from '@grafana/runtime';
import {
  CustomVariable,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';

import { contextSrv } from '../../../../../core/services/context_srv';
import * as sharePublicDashboardUtils from '../../../../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene, DashboardSceneState } from '../../../scene/DashboardScene';
import { activateFullSceneTree } from '../../../utils/test-utils';
import { ShareDrawer } from '../../ShareDrawer/ShareDrawer';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
const shareExternallySelector = e2eSelectors.pages.ShareDashboardDrawer.ShareExternally;

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

beforeEach(() => {
  config.featureToggles.newDashboardSharingComponent = true;
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
    jest.spyOn(sharePublicDashboardUtils, 'dashboardHasTemplateVariables').mockReturnValue(true);

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

async function buildAndRenderScenario({
  overrides,
  panelOverrides,
}: {
  overrides?: Partial<DashboardSceneState>;
  panelOverrides?: Partial<VizPanelState>;
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

  render(<drawer.Component model={drawer} />);

  await waitForElementToBeRemoved(screen.getByText('Loading configuration'));

  return drawer.Component;
}

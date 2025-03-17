import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, UrlSyncContextProvider } from '@grafana/scenes';

import { render } from '../../../../../test/test-utils';
import { shareDashboardType } from '../../../dashboard/components/ShareModal/utils';
import { DashboardScene } from '../../scene/DashboardScene';
import { activateFullSceneTree } from '../../utils/test-utils';

import { ShareDrawer } from './ShareDrawer';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
}));

describe('ShareDrawer', () => {
  it('removes shareView query param from url when it is closed', async () => {
    const { dashboard } = await buildAndRenderScenario();

    render(
      <UrlSyncContextProvider scene={dashboard}>
        <dashboard.Component model={dashboard} />
      </UrlSyncContextProvider>
    );

    act(() => locationService.partial({ shareView: 'link' }));

    expect(locationService.getSearch().get('shareView')).toBe('link');
    expect(await screen.findByText('Share externally')).toBeInTheDocument();
    const closeButton = await screen.findByTestId(selectors.components.Drawer.General.close);
    await act(() => userEvent.click(closeButton));

    expect(locationService.getSearch().get('shareView')).toBe(null);
  });
});

async function buildAndRenderScenario() {
  const drawer = new ShareDrawer({ shareView: shareDashboardType.publicDashboard });

  const dashboard = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    $timeRange: new SceneTimeRange({}),
    overlay: drawer,
  });

  drawer.activate();
  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));
  return { dashboard };
}

import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, UrlSyncContextProvider } from '@grafana/scenes';

import { render } from '../../../../../test/test-utils';
import { ExportFormat } from '../../../dashboard/api/types';
import { shareDashboardType } from '../../../dashboard/components/ShareModal/utils';
import { DashboardScene } from '../../scene/DashboardScene';
import { activateFullSceneTree } from '../../utils/test-utils';
import { ExportAsCode } from '../ExportButton/ExportAsCode';

import { ShareDrawer } from './ShareDrawer';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
}));

const mockShareRenderersLoaded = jest.fn();

jest.mock('../ShareRenderers', () => {
  mockShareRenderersLoaded();
  return jest.requireActual('../ShareRenderers');
});

describe('ShareDrawer', () => {
  it('builds export state synchronously without loading its content until render', async () => {
    const drawer = new ShareDrawer({ shareView: shareDashboardType.export });
    const dashboard = new DashboardScene({
      title: 'Export dashboard',
      uid: 'dash-1',
      meta: {},
      overlay: drawer,
    });
    const deactivate = drawer.activate();

    const activeShare = drawer.state.activeShare;
    if (!(activeShare instanceof ExportAsCode)) {
      throw new Error('Expected the export scene to be ready on activation');
    }

    expect(activeShare.getTabLabel()).toBe('Export dashboard');
    expect(activeShare.state.onDismiss).toBe(drawer.onDismiss);
    activeShare.onExportFormatChange(ExportFormat.V2Resource);
    expect(activeShare.state.exportFormat).toBe(ExportFormat.V2Resource);
    expect(mockShareRenderersLoaded).not.toHaveBeenCalled();

    jest.spyOn(activeShare, 'getExportableDashboardJson').mockResolvedValue({
      json: { title: dashboard.state.title, schemaVersion: 41 },
      initialSaveModelVersion: 'v1',
    });
    locationService.partial({ shareView: shareDashboardType.export });
    render(<drawer.Component model={drawer} />);

    expect(await screen.findByRole('button', { name: 'Download file' })).toBeInTheDocument();
    expect(mockShareRenderersLoaded).toHaveBeenCalledTimes(1);
    expect(drawer.state.activeShare).toBe(activeShare);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(locationService.getSearch().get('shareView')).toBe(null);

    deactivate();
  });

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
    await userEvent.click(closeButton);

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

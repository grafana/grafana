import { act, render as RTLRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, setPluginImportUtils } from '@grafana/runtime';
import { behaviors, SceneGridLayout, SceneTimeRange, UrlSyncContextProvider, VizPanel } from '@grafana/scenes';

import { render } from '../../../../../test/test-utils';
import { isEmailSharingEnabled } from '../../../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { shareDashboardType } from '../../../dashboard/components/ShareModal/utils';
import { DashboardGridItem } from '../../scene/DashboardGridItem';
import { DashboardScene } from '../../scene/DashboardScene';
import { activateFullSceneTree } from '../../utils/test-utils';

import { ShareDrawer } from './ShareDrawer';
import { GrafanaRouteComponentProps } from '../../../../core/navigation/types';
import { getGrafanaContextMock } from '../../../../../test/mocks/getGrafanaContextMock';
import { getRouteComponentProps } from '../../../../core/navigation/__mocks__/routeProps';
import { DashboardScenePage, Props } from '../../pages/DashboardScenePage';
import { TestProvider } from '../../../../../test/helpers/TestProvider';
import { DashboardCursorSync } from '@grafana/schema/dist/esm/raw/dashboard/x/dashboard_types.gen';
import { DashboardControls } from '../../scene/DashboardControls';
import * as React from 'react';
import { PROVISIONED_MIMIR_ALERTMANAGER_UID } from '../../../alerting/unified/components/settings/__mocks__/server';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../alerting/unified/utils/datasource';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn().mockReturnValue({
    pathname: '/d/dash-1',
    hash: '',
    state: null,
  }),
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
    body: new SceneGridLayout({
      children: [],
    }),
    overlay: drawer,
  });

  drawer.activate();
  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));
  return { dashboard };
}

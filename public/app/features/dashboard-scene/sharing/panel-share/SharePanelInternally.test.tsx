import { render, screen } from '@testing-library/react';
import { advanceTo, clear } from 'jest-date-mock';

import { dateTime } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config, locationService, setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { SharePanelInternally } from './SharePanelInternally';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('SharePanelInternally', () => {
  const fakeCurrentDate = dateTime('2019-02-11T19:00:00.000Z').toDate();

  afterAll(() => {
    clear();
  });

  beforeAll(() => {
    advanceTo(fakeCurrentDate);

    config.appUrl = 'http://dashboards.grafana.com/grafana/';
    config.rendererAvailable = true;
    config.bootData.user.orgId = 1;
    config.featureToggles.dashboardSceneForViewers = true;
    locationService.push('/d/dash-1?from=now-6h&to=now');
  });

  it('should generate share url absolute time', async () => {
    buildAndRenderScenario();

    expect(await screen.findByTestId('saraza')).toBeInTheDocument();
  });
});

function buildAndRenderScenario() {
  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
  });
  const tab = new SharePanelInternally({ panelRef: panel.getRef() });
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    $timeRange: new SceneTimeRange({}),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
    overlay: tab,
  });

  activateFullSceneTree(scene);

  render(<tab.Component model={tab} />);

  return tab;
}

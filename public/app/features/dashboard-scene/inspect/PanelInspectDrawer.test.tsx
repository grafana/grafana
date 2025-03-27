import { locationService } from '@grafana/runtime';

import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { onPanelInspectClose } from './PanelInspectDrawer';

describe('onPanelInspectClose', () => {
  test('when on default home dashboard page', async () => {
    locationService.push('/');

    const { scene } = await buildTestScene({
      url: '',
      slug: '',
    });

    onPanelInspectClose(scene);
    expect(locationService.getLocation().pathname).toBe('/');
  });

  test('when on custom home dashboard page with uid defined', async () => {
    locationService.push('/');

    const { scene } = await buildTestScene(
      {
        url: '',
        slug: '',
      },
      'home-dash '
    );

    onPanelInspectClose(scene);
    expect(locationService.getLocation().pathname).toBe('/');
  });

  test('when on new dashboard page', async () => {
    locationService.push('/dashboard/new');
    const { scene } = await buildTestScene(
      {
        url: '',
        slug: '',
      },
      ''
    );

    onPanelInspectClose(scene);
    expect(locationService.getLocation().pathname).toBe('/dashboard/new');
  });

  test('when on a dashboard page', async () => {
    const { scene } = await buildTestScene(
      {
        slug: 'dash-slug',
        url: '/d/dash-uid/dash-slug',
      },
      'dash-uid'
    );

    onPanelInspectClose(scene);
    expect(locationService.getLocation().pathname).toBe('/d/dash-uid/dash-slug');
  });
});

async function buildTestScene(metaOverride?: DashboardSceneState['meta'], uid = 'dash-1') {
  const scene = new DashboardScene({
    title: 'hello',
    uid,
    meta: {
      canEdit: true,
      ...metaOverride,
    },
    body: DefaultGridLayoutManager.fromVizPanels([]),
  });

  return { scene };
}

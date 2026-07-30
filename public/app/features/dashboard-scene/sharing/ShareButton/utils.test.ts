import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import { buildShareUrl } from './utils';

const createAndCopyShareDashboardLinkMock = jest.fn();
jest.mock('app/core/utils/shortLinks', () => ({
  ...jest.requireActual('app/core/utils/shortLinks'),
  createAndCopyShareDashboardLink: (...args: unknown[]) => createAndCopyShareDashboardLinkMock(...args),
}));

describe('buildShareUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should forward the focused panel so the copied link targets that panel', async () => {
    const { dashboard, panel } = setup();

    await buildShareUrl(dashboard, panel);

    expect(createAndCopyShareDashboardLinkMock).toHaveBeenCalledWith(
      dashboard,
      expect.objectContaining({ useAbsoluteTimeRange: true, useShortUrl: true, theme: 'current' }),
      panel
    );
  });

  it('should copy a dashboard-level link when no panel is provided', async () => {
    const { dashboard } = setup();

    await buildShareUrl(dashboard);

    expect(createAndCopyShareDashboardLinkMock).toHaveBeenCalledWith(dashboard, expect.any(Object), undefined);
  });
});

function setup() {
  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
  });

  const dashboard = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    $timeRange: new SceneTimeRange({}),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  return { dashboard, panel };
}

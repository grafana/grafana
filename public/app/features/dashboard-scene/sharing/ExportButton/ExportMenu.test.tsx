import { render, screen } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import ExportMenu from './ExportMenu';

describe('ExportMenu', () => {
  it('should render menu items', async () => {
    setup();
    expect(await screen.findByRole('menuitem', { name: /export as json/i })).toBeInTheDocument();
  });

  describe('sharingDashboardImage feature toggle', () => {
    it('should render image export option when enabled', async () => {
      config.featureToggles.sharingDashboardImage = true;
      setup();
      expect(await screen.findByRole('menuitem', { name: /export as image/i })).toBeInTheDocument();
    });

    it('should not render image export option when disabled', async () => {
      config.featureToggles.sharingDashboardImage = false;
      setup();
      expect(screen.queryByRole('menuitem', { name: /export as image/i })).not.toBeInTheDocument();
    });
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

  render(<ExportMenu dashboard={dashboard} />);
}

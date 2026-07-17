import { render, screen } from '@testing-library/react';

import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import ExportMenu from './ExportMenu';

describe('ExportMenu', () => {
  it('should render menu items', async () => {
    setup();
    expect(await screen.findByRole('menuitem', { name: /export as code/i })).toBeInTheDocument();
  });

  it('should render image export option', async () => {
    setup();
    expect(await screen.findByRole('menuitem', { name: /export as image/i })).toBeInTheDocument();
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

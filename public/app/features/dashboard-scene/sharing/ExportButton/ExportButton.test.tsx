import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import ExportButton from './ExportButton';

describe('ExportButton', () => {
  it('should render Export button', async () => {
    setup();
    expect(await screen.findByRole('button', { name: /export dashboard/i })).toBeInTheDocument();
  });

  it('should show menu when export button is clicked', async () => {
    setup();

    const exportButton = await screen.findByRole('button', { name: /export dashboard/i });
    expect(exportButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(exportButton);

    expect(exportButton).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('should show export options in the menu', async () => {
    setup();

    const exportButton = await screen.findByRole('button', { name: /export dashboard/i });
    await userEvent.click(exportButton);

    // Should show JSON export option
    expect(await screen.findByRole('menuitem', { name: /export as json/i })).toBeInTheDocument();
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

  render(<ExportButton dashboard={dashboard} />);
}

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import ExportButton from './ExportButton';

const selector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton;

describe('ExportButton', () => {
  it('should render Export menu', async () => {
    setup();
    expect(await screen.findByTestId(selector.arrowMenu)).toBeInTheDocument();
  });

  it('should render menu when arrow button clicked', async () => {
    setup();

    const arrowMenu = await screen.findByTestId(selector.arrowMenu);
    await userEvent.click(arrowMenu);

    expect(await screen.findByTestId(selector.Menu.container)).toBeInTheDocument();
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

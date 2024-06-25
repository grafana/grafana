import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from '../../scene/DashboardGridItem';
import { DashboardScene } from '../../scene/DashboardScene';

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
    body: new SceneGridLayout({
      children: [
        new DashboardGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: panel,
        }),
      ],
    }),
  });

  render(<ExportButton dashboard={dashboard} />);
}

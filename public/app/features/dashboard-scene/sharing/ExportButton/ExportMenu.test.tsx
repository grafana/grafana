import { render, screen } from '@testing-library/react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from '../../scene/DashboardGridItem';
import { DashboardScene } from '../../scene/DashboardScene';

import ExportMenu from './ExportMenu';

const selector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton.Menu;

describe('ExportMenu', () => {
  it('should render menu items', async () => {
    setup();
    expect(await screen.findByTestId(selector.exportAsPdf)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.exportAsJson)).toBeInTheDocument();
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
  render(<ExportMenu dashboard={dashboard} />);
}

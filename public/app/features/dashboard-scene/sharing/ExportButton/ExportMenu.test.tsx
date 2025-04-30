import { render, screen } from '@testing-library/react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import ExportMenu from './ExportMenu';

const selector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton.Menu;

describe('ExportMenu', () => {
  it('should render menu items', async () => {
    setup();
    expect(await screen.findByTestId(selector.exportAsJson)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.exportAsImage)).toBeInTheDocument();
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

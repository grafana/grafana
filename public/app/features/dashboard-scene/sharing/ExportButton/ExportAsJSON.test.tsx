import { render, screen } from '@testing-library/react';
import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from '../../scene/DashboardGridItem';
import { DashboardScene } from '../../scene/DashboardScene';

import ExportAsJSON from './ExportAsJSON';

const selector = e2eSelectors.pages.ExportDashboardDrawer.ExportAsJson;

describe('Export As JSON', () => {
  it('should render Export As JSON Drawer', async () => {
    setup();
    expect(await screen.findByTestId(selector.exportExternallyToggle)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.codeEditor)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.saveToFileButton)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.copyToClipboardButton)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.cancelButton)).toBeInTheDocument();
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

  render(<ExportAsJSON dashboardRef={dashboard.getRef()} />);
}

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { config } from '../../../../core/config';
import { DashboardGridItem } from '../../scene/DashboardGridItem';
import { DashboardScene } from '../../scene/DashboardScene';

import ShareMenu from './ShareMenu';

const createAndCopyDashboardShortLinkMock = jest.fn();
jest.mock('app/core/utils/shortLinks', () => ({
  ...jest.requireActual('app/core/utils/shortLinks'),
  createAndCopyDashboardShortLink: () => createAndCopyDashboardShortLinkMock(),
}));

const selector = e2eSelectors.pages.Dashboard.DashNav.newShareButton.menu;
describe('ShareMenu', () => {
  it('should render menu items', async () => {
    config.featureToggles.publicDashboards = true;
    config.publicDashboardsEnabled = true;
    setup();

    expect(await screen.findByTestId(selector.shareInternally)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.shareExternally)).toBeInTheDocument();
  });
  it('should no share externally when public dashboard is disabled', async () => {
    config.featureToggles.publicDashboards = false;
    config.publicDashboardsEnabled = false;
    setup();

    expect(await screen.queryByTestId(selector.shareExternally)).not.toBeInTheDocument();
  });
  it('should call createAndCopyDashboardShortLink when share internally clicked', async () => {
    setup();

    const shareLink = await screen.findByTestId(selector.shareInternally);

    await userEvent.click(shareLink);
    expect(createAndCopyDashboardShortLinkMock).toHaveBeenCalled();
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

  render(<ShareMenu dashboard={dashboard} />);
}

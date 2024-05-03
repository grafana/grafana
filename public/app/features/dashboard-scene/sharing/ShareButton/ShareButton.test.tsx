import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from '../../scene/DashboardGridItem';
import { DashboardScene } from '../../scene/DashboardScene';

import ShareButton from './ShareButton';

const createAndCopyDashboardShortLinkMock = jest.fn();
jest.mock('app/core/utils/shortLinks', () => ({
  ...jest.requireActual('app/core/utils/shortLinks'),
  createAndCopyDashboardShortLink: () => createAndCopyDashboardShortLinkMock(),
}));

const selector = e2eSelectors.pages.Dashboard.DashNav.newShareButton;
describe('ShareButton', () => {
  it('should render share link button and menu', async () => {
    setup();

    expect(await screen.findByTestId(selector.shareLink)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.arrowMenu)).toBeInTheDocument();
  });

  it('should call createAndCopyDashboardShortLink when share link clicked', async () => {
    setup();

    const shareLink = await screen.findByTestId(selector.shareLink);

    await userEvent.click(shareLink);
    expect(createAndCopyDashboardShortLinkMock).toHaveBeenCalled();
  });

  it('should render menu when arrow button clicked', async () => {
    setup();

    const arrowMenu = await screen.findByTestId(selector.arrowMenu);
    await userEvent.click(arrowMenu);

    expect(await screen.findByTestId(selector.menu.container)).toBeInTheDocument();
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

  render(<ShareButton dashboard={dashboard} />);
}

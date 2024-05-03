import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

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

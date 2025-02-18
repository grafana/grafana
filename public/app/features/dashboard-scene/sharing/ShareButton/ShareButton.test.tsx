import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

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
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  render(<ShareButton dashboard={dashboard} />);
}

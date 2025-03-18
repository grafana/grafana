import { act, render } from '@testing-library/react';

import { toUtc } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneTimeRange } from '@grafana/scenes';

import { DashboardControls } from './DashboardControls';
import { DashboardScene } from './DashboardScene';

const mockGetAnchorInfo = jest.fn((link) => ({
  href: `/dashboard/${link.title}`,
  title: link.title,
  tooltip: link.tooltip || null,
}));

// Mock the getLinkSrv function
jest.mock('app/features/panel/panellinks/link_srv', () => ({
  getLinkSrv: jest.fn(() => ({
    getAnchorInfo: mockGetAnchorInfo,
  })),
}));

describe('DashboardLinksControls', () => {
  it('renders dashboard links correctly', () => {
    const { controls } = buildTestScene();
    const renderer = render(<controls.Component model={controls} />);

    // // Expect two dashboard link containers to be rendered
    const linkContainers = renderer.getAllByTestId(selectors.components.DashboardLinks.container);
    expect(linkContainers).toHaveLength(2);

    // Check link titles and hrefs
    const links = renderer.getAllByTestId(selectors.components.DashboardLinks.link);
    expect(links[0]).toHaveTextContent('Link 1');
    expect(links[1]).toHaveTextContent('Link 2');
  });

  it('updates link hrefs when time range changes', () => {
    const { controls, dashboard } = buildTestScene();
    render(<controls.Component model={controls} />);

    //clear initial calls to getAnchorInfo
    mockGetAnchorInfo.mockClear();

    act(() => {
      // Update time range
      dashboard.state.$timeRange?.setState({
        value: {
          from: toUtc('2021-01-01'),
          to: toUtc('2021-01-02'),
          raw: { from: toUtc('2020-01-01'), to: toUtc('2020-01-02') },
        },
      });
    });

    //expect getAnchorInfo to be called twice, once for each link, after time range change
    expect(mockGetAnchorInfo).toHaveBeenCalledTimes(2);
  });
});

function buildTestScene(): { controls: DashboardControls; dashboard: DashboardScene } {
  const dashboard = new DashboardScene({
    uid: 'A',
    links: [
      {
        title: 'Link 1',
        url: 'http://localhost:3000/$A',
        type: 'link',
        asDropdown: false,
        icon: '',
        includeVars: true,
        keepTime: true,
        tags: [],
        targetBlank: false,
        tooltip: 'Link 1',
      },
      {
        title: 'Link 2',
        url: 'http://localhost:3000/$A',
        type: 'link',
        asDropdown: false,
        icon: '',
        includeVars: true,
        keepTime: true,
        tags: [],
        targetBlank: false,
        tooltip: 'Link 2',
      },
    ],
    controls: new DashboardControls({}),
    $timeRange: new SceneTimeRange({
      from: 'now-1',
      to: 'now',
    }),
  });

  dashboard.activate();

  return { controls: dashboard.state.controls as DashboardControls, dashboard };
}

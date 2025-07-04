import { render, screen } from '@testing-library/react';

import { BootData } from '@grafana/data';
import { setEchoSrv } from '@grafana/runtime';
import config from 'app/core/config';

import { Echo } from '../../../../core/services/echo/Echo';
import { PanelModel } from '../../state/PanelModel';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import { ShareEmbed } from './ShareEmbed';

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: () => ({
    timeRange: () => {
      return { from: new Date(1000), to: new Date(2000) };
    },
  }),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    sidemenu: true,
    user: {},
    isSignedIn: false,
    isGrafanaAdmin: false,
    isEditor: false,
    hasEditPermissionFolders: false,
  },
}));

function mockLocationHref(href: string) {
  const win: typeof globalThis = window;
  const location = win.location;

  let search = '';
  const searchPos = href.indexOf('?');
  if (searchPos >= 0) {
    search = href.substring(searchPos);
  }

  // @ts-ignore
  delete win.location;
  win.location = {
    ...location,
    href,
    origin: new URL(href).origin,
    search,
  };
}

describe('ShareEmbed', () => {
  let originalBootData: BootData;

  beforeAll(() => {
    setEchoSrv(new Echo());
    originalBootData = config.bootData;
    config.appUrl = 'http://dashboards.grafana.com/';

    config.bootData = {
      user: {
        orgId: 1,
      },
    } as BootData;
  });

  afterAll(() => {
    config.bootData = originalBootData;
  });

  it('generates the correct embed url for a dashboard', () => {
    const mockDashboard = createDashboardModelFixture({
      uid: 'mockDashboardUid',
    });
    const mockPanel = new PanelModel({
      id: 'mockPanelId',
    });
    mockLocationHref(`http://dashboards.grafana.com/d/${mockDashboard.uid}?orgId=1`);
    render(<ShareEmbed dashboard={mockDashboard} panel={mockPanel} />);

    const embedUrl = screen.getByTestId('share-embed-html');
    expect(embedUrl).toBeInTheDocument();
    expect(embedUrl).toHaveTextContent(
      `http://dashboards.grafana.com/d-solo/${mockDashboard.uid}?orgId=1&from=1000&to=2000&panelId=${mockPanel.id}`
    );
  });

  it('generates the correct embed url for a dashboard set to the homepage in the grafana config', () => {
    mockLocationHref('http://dashboards.grafana.com/?orgId=1');
    const mockDashboard = createDashboardModelFixture({
      uid: 'mockDashboardUid',
    });
    const mockPanel = new PanelModel({
      id: 'mockPanelId',
    });
    render(<ShareEmbed dashboard={mockDashboard} panel={mockPanel} />);

    const embedUrl = screen.getByTestId('share-embed-html');
    expect(embedUrl).toBeInTheDocument();
    expect(embedUrl).toHaveTextContent(
      `http://dashboards.grafana.com/d-solo/${mockDashboard.uid}?orgId=1&from=1000&to=2000&panelId=${mockPanel.id}`
    );
  });

  it('generates the correct embed url for a snapshot', () => {
    const mockSlug = 'mockSlug';
    mockLocationHref(`http://dashboards.grafana.com/dashboard/snapshot/${mockSlug}?orgId=1`);
    const mockDashboard = createDashboardModelFixture({
      uid: 'mockDashboardUid',
    });
    const mockPanel = new PanelModel({
      id: 'mockPanelId',
    });
    render(<ShareEmbed dashboard={mockDashboard} panel={mockPanel} />);

    const embedUrl = screen.getByTestId('share-embed-html');
    expect(embedUrl).toBeInTheDocument();
    expect(embedUrl).toHaveTextContent(
      `http://dashboards.grafana.com/dashboard-solo/snapshot/${mockSlug}?orgId=1&from=1000&to=2000&panelId=${mockPanel.id}`
    );
  });

  it('generates the correct embed url for a scripted dashboard', () => {
    const mockSlug = 'scripted.js';
    mockLocationHref(`http://dashboards.grafana.com/dashboard/script/${mockSlug}?orgId=1`);
    const mockDashboard = createDashboardModelFixture({
      uid: 'mockDashboardUid',
    });
    const mockPanel = new PanelModel({
      id: 'mockPanelId',
    });
    render(<ShareEmbed dashboard={mockDashboard} panel={mockPanel} />);

    const embedUrl = screen.getByTestId('share-embed-html');
    expect(embedUrl).toBeInTheDocument();
    expect(embedUrl).toHaveTextContent(
      `http://dashboards.grafana.com/dashboard-solo/script/${mockSlug}?orgId=1&from=1000&to=2000&panelId=${mockPanel.id}`
    );
  });
});

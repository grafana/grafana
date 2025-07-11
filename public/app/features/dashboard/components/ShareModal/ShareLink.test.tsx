import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BootData, getDefaultTimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setEchoSrv, setTemplateSrv } from '@grafana/runtime';
import config from 'app/core/config';

import { initTemplateSrv } from '../../../../../test/helpers/initTemplateSrv';
import { Echo } from '../../../../core/services/echo/Echo';
import { variableAdapters } from '../../../variables/adapters';
import { createQueryVariableAdapter } from '../../../variables/query/adapter';
import { PanelModel } from '../../state/PanelModel';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import { Props, ShareLink } from './ShareLink';

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: () => ({
    timeRange: () => {
      return { from: new Date(1000), to: new Date(2000) };
    },
  }),
}));

function mockLocationHref(href: string) {
  const location = window.location;

  let search = '';
  const searchPos = href.indexOf('?');
  if (searchPos >= 0) {
    search = href.substring(searchPos);
  }

  const win: typeof globalThis = window;
  //@ts-ignore
  delete win.location;
  win.location = {
    ...location,
    href,
    origin: new URL(href).origin,
    search,
  };
}

const mockUid = 'abc123';
jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');

  return {
    ...original,
    getBackendSrv: () => ({
      post: jest.fn().mockResolvedValue({
        uid: mockUid,
        url: `http://localhost:3000/goto/${mockUid}`,
      }),
    }),
  };
});

describe('ShareModal', () => {
  let templateSrv = initTemplateSrv('key', []);
  let props: Props;

  beforeAll(() => {
    setEchoSrv(new Echo());
    variableAdapters.register(createQueryVariableAdapter());
    setTemplateSrv(templateSrv);
  });

  beforeEach(() => {
    const defaultTimeRange = getDefaultTimeRange();
    jest.spyOn(window.Intl, 'DateTimeFormat').mockImplementation(() => {
      return {
        resolvedOptions: () => {
          return { timeZone: 'UTC' };
        },
      } as Intl.DateTimeFormat;
    });
    mockLocationHref('http://server/#!/test');
    config.rendererAvailable = true;
    config.bootData.user.orgId = 1;
    props = {
      panel: new PanelModel({ id: 22, options: {}, fieldConfig: { defaults: {}, overrides: [] } }),
      dashboard: createDashboardModelFixture({
        time: {
          from: defaultTimeRange.from.toISOString(),
          to: defaultTimeRange.to.toISOString(),
        },
        id: 1,
      }),
    };
  });

  describe('with current time range and panel', () => {
    it('should generate share url absolute time', async () => {
      render(<ShareLink {...props} />);
      expect(await screen.findByRole('textbox', { name: 'Link URL' })).toHaveValue(
        'http://server/#!/test?from=1000&to=2000&orgId=1&viewPanel=22'
      );
    });

    it('should generate render url', async () => {
      mockLocationHref('http://dashboards.grafana.com/d/abcdefghi/my-dash');
      render(<ShareLink {...props} />);

      const base = 'http://dashboards.grafana.com/render/d-solo/abcdefghi/my-dash';
      const params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&scale=1&tz=UTC';
      expect(
        await screen.findByRole('link', { name: selectors.pages.SharePanelModal.linkToRenderedImage })
      ).toHaveAttribute('href', base + params);
    });

    it('should generate render url for scripted dashboard', async () => {
      mockLocationHref('http://dashboards.grafana.com/dashboard/script/my-dash.js');
      render(<ShareLink {...props} />);

      const base = 'http://dashboards.grafana.com/render/dashboard-solo/script/my-dash.js';
      const params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&scale=1&tz=UTC';
      expect(
        await screen.findByRole('link', { name: selectors.pages.SharePanelModal.linkToRenderedImage })
      ).toHaveAttribute('href', base + params);
    });

    it('should remove panel id when no panel in scope', async () => {
      props.panel = undefined;
      render(<ShareLink {...props} />);
      expect(await screen.findByRole('textbox', { name: 'Link URL' })).toHaveValue(
        'http://server/#!/test?from=1000&to=2000&orgId=1'
      );
    });

    it('should add theme when specified', async () => {
      props.panel = undefined;
      render(<ShareLink {...props} />);

      await userEvent.click(screen.getByLabelText('Light'));
      expect(await screen.findByRole('textbox', { name: 'Link URL' })).toHaveValue(
        'http://server/#!/test?from=1000&to=2000&orgId=1&theme=light'
      );
    });

    it('should remove editPanel from image url when is first param in querystring', async () => {
      mockLocationHref('http://server/#!/test?editPanel=1');
      render(<ShareLink {...props} />);

      const base = 'http://server';
      const path = '/#!/test';
      expect(await screen.findByRole('textbox', { name: 'Link URL' })).toHaveValue(
        base + path + '?editPanel=1&from=1000&to=2000&orgId=1'
      );
      expect(
        await screen.findByRole('link', { name: selectors.pages.SharePanelModal.linkToRenderedImage })
      ).toHaveAttribute(
        'href',
        base + path + '?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&scale=1&tz=UTC'
      );
    });

    it('should shorten url', async () => {
      render(<ShareLink {...props} />);

      await userEvent.click(await screen.findByLabelText('Shorten URL'));
      expect(await screen.findByRole('textbox', { name: 'Link URL' })).toHaveValue(
        `http://localhost:3000/goto/${mockUid}`
      );
    });

    it('should generate render url without shareView param', async () => {
      mockLocationHref('http://dashboards.grafana.com/d/abcdefghi/my-dash?shareView=link');
      render(<ShareLink {...props} />);

      const base = 'http://dashboards.grafana.com/render/d-solo/abcdefghi/my-dash';
      const params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&scale=1&tz=UTC';
      expect(
        await screen.findByRole('link', { name: selectors.pages.SharePanelModal.linkToRenderedImage })
      ).toHaveAttribute('href', base + params);
    });
  });
});

describe('when appUrl is set in the grafana config', () => {
  let originalBootData: BootData;

  beforeAll(() => {
    originalBootData = config.bootData;
    config.appUrl = 'http://dashboards.grafana.com/';
    config.rendererAvailable = true;
    config.bootData.user.orgId = 1;
  });

  afterAll(() => {
    config.bootData = originalBootData;
  });

  it('should render the correct link', async () => {
    const mockDashboard = createDashboardModelFixture({
      uid: 'mockDashboardUid',
      id: 1,
    });
    const mockPanel = new PanelModel({
      id: 'mockPanelId',
    });
    const props: Props = {
      dashboard: mockDashboard,
      panel: mockPanel,
    };
    mockLocationHref('http://dashboards.grafana.com/?orgId=1');
    render(<ShareLink {...props} />);

    expect(
      await screen.findByRole('link', { name: selectors.pages.SharePanelModal.linkToRenderedImage })
    ).toHaveAttribute(
      'href',
      `http://dashboards.grafana.com/render/d-solo/${mockDashboard.uid}?orgId=1&from=1000&to=2000&panelId=${mockPanel.id}&width=1000&height=500&scale=1&tz=UTC`
    );
  });
});

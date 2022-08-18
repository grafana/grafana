import { shallow, ShallowWrapper } from 'enzyme';
import React from 'react';

import { getDefaultTimeRange } from '@grafana/data';
import { setEchoSrv, setTemplateSrv } from '@grafana/runtime';
import config from 'app/core/config';

import { initTemplateSrv } from '../../../../../test/helpers/initTemplateSrv';
import { Echo } from '../../../../core/services/echo/Echo';
import { variableAdapters } from '../../../variables/adapters';
import { createQueryVariableAdapter } from '../../../variables/query/adapter';
import { DashboardModel, PanelModel } from '../../state';

import { Props, ShareLink, State } from './ShareLink';

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

  //@ts-ignore
  delete window.location;
  window.location = {
    ...location,
    href,
    origin: new URL(href).origin,
    search,
  };
}

function setUTCTimeZone() {
  (window as any).Intl.DateTimeFormat = () => {
    return {
      resolvedOptions: () => {
        return { timeZone: 'UTC' };
      },
    };
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

interface ScenarioContext {
  wrapper?: ShallowWrapper<Props, State, ShareLink>;
  mount: (propOverrides?: Partial<Props>) => void;
  setup: (fn: () => void) => void;
}

function shareLinkScenario(description: string, scenarioFn: (ctx: ScenarioContext) => void) {
  describe(description, () => {
    let setupFn: () => void;

    const ctx: any = {
      setup: (fn: any) => {
        setupFn = fn;
      },
      mount: (propOverrides?: any) => {
        const props: any = {
          panel: undefined,
          dashboard: { time: getDefaultTimeRange() },
        };

        Object.assign(props, propOverrides);
        ctx.wrapper = shallow(<ShareLink {...props} />);
      },
    };

    beforeEach(() => {
      setUTCTimeZone();
      setupFn();
    });

    scenarioFn(ctx);
  });
}

describe('ShareModal', () => {
  let templateSrv = initTemplateSrv('key', []);

  beforeAll(() => {
    setEchoSrv(new Echo());
    variableAdapters.register(createQueryVariableAdapter());
    setTemplateSrv(templateSrv);
  });

  shareLinkScenario('shareUrl with current time range and panel', (ctx) => {
    ctx.setup(() => {
      mockLocationHref('http://server/#!/test');
      config.bootData = {
        user: {
          orgId: 1,
        },
      } as any;
      ctx.mount({
        panel: new PanelModel({ id: 22, options: {}, fieldConfig: { defaults: {}, overrides: [] } }),
      });
    });

    it('should generate share url absolute time', async () => {
      await ctx.wrapper?.instance().buildUrl();
      const state = ctx.wrapper?.state();
      expect(state?.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1&viewPanel=22');
    });

    it('should generate render url', async () => {
      mockLocationHref('http://dashboards.grafana.com/d/abcdefghi/my-dash');
      ctx.mount({
        panel: new PanelModel({ id: 22, options: {}, fieldConfig: { defaults: {}, overrides: [] } }),
      });

      await ctx.wrapper?.instance().buildUrl();
      const state = ctx.wrapper?.state();
      const base = 'http://dashboards.grafana.com/render/d-solo/abcdefghi/my-dash';
      const params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
      expect(state?.imageUrl).toContain(base + params);
    });

    it('should generate render url for scripted dashboard', async () => {
      mockLocationHref('http://dashboards.grafana.com/dashboard/script/my-dash.js');
      ctx.mount({
        panel: new PanelModel({ id: 22, options: {}, fieldConfig: { defaults: {}, overrides: [] } }),
      });

      await ctx.wrapper?.instance().buildUrl();
      const state = ctx.wrapper?.state();
      const base = 'http://dashboards.grafana.com/render/dashboard-solo/script/my-dash.js';
      const params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
      expect(state?.imageUrl).toContain(base + params);
    });

    it('should remove panel id when no panel in scope', async () => {
      ctx.mount({
        panel: undefined,
      });

      await ctx.wrapper?.instance().buildUrl();
      const state = ctx.wrapper?.state();
      expect(state?.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1');
    });

    it('should add theme when specified', async () => {
      ctx.wrapper?.setProps({ panel: undefined });
      ctx.wrapper?.setState({ selectedTheme: 'light' });

      await ctx.wrapper?.instance().buildUrl();
      const state = ctx.wrapper?.state();
      expect(state?.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1&theme=light');
    });

    it('should remove editPanel from image url when is first param in querystring', async () => {
      mockLocationHref('http://server/#!/test?editPanel=1');
      ctx.mount({
        panel: new PanelModel({ id: 1, options: {}, fieldConfig: { defaults: {}, overrides: [] } }),
      });

      await ctx.wrapper?.instance().buildUrl();
      const state = ctx.wrapper?.state();
      expect(state?.shareUrl).toContain('?editPanel=1&from=1000&to=2000&orgId=1');
      expect(state?.imageUrl).toContain('?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&tz=UTC');
    });

    it('should shorten url', () => {
      mockLocationHref('http://server/#!/test');
      ctx.mount();
      ctx.wrapper?.setState({ useShortUrl: true }, async () => {
        await ctx.wrapper?.instance().buildUrl();
        const state = ctx.wrapper?.state();
        expect(state?.shareUrl).toContain(`/goto/${mockUid}`);
      });
    });
  });
});

describe('when default_home_dashboard_path is set in the grafana config', () => {
  let originalBootData: any;

  beforeAll(() => {
    originalBootData = config.bootData;
    config.appUrl = 'http://dashboards.grafana.com/';

    config.bootData = {
      user: {
        orgId: 1,
      },
    } as any;
  });

  afterAll(() => {
    config.bootData = originalBootData;
  });

  it('should render the correct link', async () => {
    const mockDashboard = new DashboardModel({
      uid: 'mockDashboardUid',
    });
    const mockPanel = new PanelModel({
      id: 'mockPanelId',
    });
    mockLocationHref('http://dashboards.grafana.com/?orgId=1');
    const test: ShallowWrapper<Props, State, ShareLink> = shallow(
      <ShareLink dashboard={mockDashboard} panel={mockPanel} />
    );
    await test.instance().buildUrl();
    expect(test.state().imageUrl).toBe(
      `http://dashboards.grafana.com/render/d-solo/${mockDashboard.uid}?orgId=1&from=1000&to=2000&panelId=${mockPanel.id}&width=1000&height=500&tz=UTC`
    );
  });
});

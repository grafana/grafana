import React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import config from 'app/core/config';
import { ShareLink, Props, State } from './ShareLink';

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: () => ({
    timeRange: () => {
      return { from: new Date(1000), to: new Date(2000) };
    },
  }),
}));

let fillVariableValuesForUrlMock = (params: any) => {};

jest.mock('app/features/templating/template_srv', () => ({
  fillVariableValuesForUrl: (params: any) => {
    fillVariableValuesForUrlMock(params);
  },
}));

function mockLocationHref(href: string) {
  const location = window.location;

  let search = '';
  const searchPos = href.indexOf('?');
  if (searchPos >= 0) {
    search = href.substring(searchPos);
  }

  delete window.location;
  (window as any).location = {
    ...location,
    href,
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
  shareLinkScenario('shareUrl with current time range and panel', ctx => {
    ctx.setup(() => {
      mockLocationHref('http://server/#!/test');
      config.bootData = {
        user: {
          orgId: 1,
        },
      };
      ctx.mount({
        panel: { id: 22, options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      });
    });

    it('should generate share url absolute time', () => {
      const state = ctx.wrapper?.state();
      expect(state?.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1&panelId=22&fullscreen');
    });

    it('should generate render url', () => {
      mockLocationHref('http://dashboards.grafana.com/d/abcdefghi/my-dash');
      ctx.mount({
        panel: { id: 22, options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      });

      const state = ctx.wrapper?.state();
      const base = 'http://dashboards.grafana.com/render/d-solo/abcdefghi/my-dash';
      const params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
      expect(state?.imageUrl).toContain(base + params);
    });

    it('should generate render url for scripted dashboard', () => {
      mockLocationHref('http://dashboards.grafana.com/dashboard/script/my-dash.js');
      ctx.mount({
        panel: { id: 22, options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      });

      const state = ctx.wrapper?.state();
      const base = 'http://dashboards.grafana.com/render/dashboard-solo/script/my-dash.js';
      const params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
      expect(state?.imageUrl).toContain(base + params);
    });

    it('should remove panel id when no panel in scope', () => {
      ctx.mount({
        panel: undefined,
      });

      const state = ctx.wrapper?.state();
      expect(state?.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1');
    });

    it('should add theme when specified', () => {
      ctx.wrapper?.setProps({ panel: undefined });
      ctx.wrapper?.setState({ selectedTheme: { label: 'light', value: 'light' } });

      const state = ctx.wrapper?.state();
      expect(state?.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1&theme=light');
    });

    it('should remove fullscreen from image url when is first param in querystring and modeSharePanel is true', () => {
      mockLocationHref('http://server/#!/test?fullscreen&edit');
      ctx.mount({
        panel: { id: 1, options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      });

      const state = ctx.wrapper?.state();
      expect(state?.shareUrl).toContain('?fullscreen&edit&from=1000&to=2000&orgId=1&panelId=1');
      expect(state?.imageUrl).toContain('?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&tz=UTC');
    });

    it('should remove edit from image url when is first param in querystring and modeSharePanel is true', () => {
      mockLocationHref('http://server/#!/test?edit&fullscreen');
      ctx.mount({
        panel: { id: 1, options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      });

      const state = ctx.wrapper?.state();
      expect(state?.shareUrl).toContain('?edit&fullscreen&from=1000&to=2000&orgId=1&panelId=1');
      expect(state?.imageUrl).toContain('?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&tz=UTC');
    });

    it('should include template variables in url', () => {
      mockLocationHref('http://server/#!/test');
      fillVariableValuesForUrlMock = (params: any) => {
        params['var-app'] = 'mupp';
        params['var-server'] = 'srv-01';
      };
      ctx.mount();
      ctx.wrapper?.setState({ includeTemplateVars: true });

      const state = ctx.wrapper?.state();
      expect(state?.shareUrl).toContain(
        'http://server/#!/test?from=1000&to=2000&orgId=1&var-app=mupp&var-server=srv-01'
      );
    });
  });
});

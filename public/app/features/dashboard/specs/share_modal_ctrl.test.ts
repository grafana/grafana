import '../shareModalCtrl';
import { ShareModalCtrl } from '../shareModalCtrl';
import config from 'app/core/config';
import { LinkSrv } from 'app/features/dashboard/panellinks/link_srv';

describe('ShareModalCtrl', () => {
  const ctx = {
    timeSrv: {
      timeRange: () => {
        return { from: new Date(1000), to: new Date(2000) };
      },
    },
    $location: {
      absUrl: () => 'http://server/#!/test',
      search: () => {
        return { from: '', to: '' };
      },
    },
    scope: {
      dashboard: {
        meta: {
          isSnapshot: true,
        },
      },
    },
    templateSrv: {
      fillVariableValuesForUrl: () => {},
    },
  } as any;

  (window as any).Intl.DateTimeFormat = () => {
    return {
      resolvedOptions: () => {
        return { timeZone: 'UTC' };
      },
    };
  };

  beforeEach(() => {
    config.bootData = {
      user: {
        orgId: 1,
      },
    };

    ctx.ctrl = new ShareModalCtrl(
      ctx.scope,
      {},
      ctx.$location,
      {},
      ctx.timeSrv,
      ctx.templateSrv,
      new LinkSrv({}, ctx.stimeSrv)
    );
  });

  describe('shareUrl with current time range and panel', () => {
    it('should generate share url absolute time', () => {
      ctx.scope.panel = { id: 22 };

      ctx.scope.init();
      expect(ctx.scope.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1&panelId=22&fullscreen');
    });

    it('should generate render url', () => {
      ctx.$location.absUrl = () => 'http://dashboards.grafana.com/d/abcdefghi/my-dash';

      ctx.scope.panel = { id: 22 };

      ctx.scope.init();
      const base = 'http://dashboards.grafana.com/render/d-solo/abcdefghi/my-dash';
      const params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
      expect(ctx.scope.imageUrl).toContain(base + params);
    });

    it('should generate render url for scripted dashboard', () => {
      ctx.$location.absUrl = () => 'http://dashboards.grafana.com/dashboard/script/my-dash.js';

      ctx.scope.panel = { id: 22 };

      ctx.scope.init();
      const base = 'http://dashboards.grafana.com/render/dashboard-solo/script/my-dash.js';
      const params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
      expect(ctx.scope.imageUrl).toContain(base + params);
    });

    it('should remove panel id when no panel in scope', () => {
      ctx.$location.absUrl = () => 'http://server/#!/test';
      ctx.scope.options.forCurrent = true;
      ctx.scope.panel = null;

      ctx.scope.init();
      expect(ctx.scope.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1');
    });

    it('should add theme when specified', () => {
      ctx.scope.options.theme = 'light';
      ctx.scope.panel = null;

      ctx.scope.init();
      expect(ctx.scope.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1&theme=light');
    });

    it('should remove fullscreen from image url when is first param in querystring and modeSharePanel is true', () => {
      ctx.$location.search = () => {
        return { fullscreen: true, edit: true };
      };
      ctx.$location.absUrl = () => 'http://server/#!/test?fullscreen&edit';
      ctx.scope.modeSharePanel = true;
      ctx.scope.panel = { id: 1 };

      ctx.scope.buildUrl();

      expect(ctx.scope.shareUrl).toContain('?fullscreen&edit&from=1000&to=2000&orgId=1&panelId=1');
      expect(ctx.scope.imageUrl).toContain('?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&tz=UTC');
    });

    it('should remove edit from image url when is first param in querystring and modeSharePanel is true', () => {
      ctx.$location.search = () => {
        return { edit: true, fullscreen: true };
      };
      ctx.$location.absUrl = () => 'http://server/#!/test?edit&fullscreen';
      ctx.scope.modeSharePanel = true;
      ctx.scope.panel = { id: 1 };

      ctx.scope.buildUrl();

      expect(ctx.scope.shareUrl).toContain('?edit&fullscreen&from=1000&to=2000&orgId=1&panelId=1');
      expect(ctx.scope.imageUrl).toContain('?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&tz=UTC');
    });

    it('should include template variables in url', () => {
      ctx.$location.search = () => {
        return {};
      };
      ctx.$location.absUrl = () => 'http://server/#!/test';
      ctx.scope.options.includeTemplateVars = true;

      ctx.templateSrv.fillVariableValuesForUrl = params => {
        params['var-app'] = 'mupp';
        params['var-server'] = 'srv-01';
      };

      ctx.scope.buildUrl();
      expect(ctx.scope.shareUrl).toContain(
        'http://server/#!/test?from=1000&to=2000&orgId=1&var-app=mupp&var-server=srv-01'
      );
    });
  });
});

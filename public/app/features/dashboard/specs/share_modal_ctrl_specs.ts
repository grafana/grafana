import { describe, beforeEach, it, expect, sinon, angularMocks } from 'test/lib/common';
import helpers from 'test/specs/helpers';
import '../shareModalCtrl';
import config from 'app/core/config';
import 'app/features/panellinks/link_srv';

describe('ShareModalCtrl', function() {
  var ctx = new helpers.ControllerTestContext();

  function setTime(range) {
    ctx.timeSrv.timeRange = sinon.stub().returns(range);
  }

  beforeEach(function() {
    config.bootData = {
      user: {
        orgId: 1,
      },
    };
  });

  setTime({ from: new Date(1000), to: new Date(2000) });

  beforeEach(angularMocks.module('grafana.controllers'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(
    angularMocks.module(function($compileProvider) {
      $compileProvider.preAssignBindingsEnabled(true);
    })
  );

  beforeEach(ctx.providePhase());

  beforeEach(ctx.createControllerPhase('ShareModalCtrl'));

  describe('shareUrl with current time range and panel', function() {
    it('should generate share url absolute time', function() {
      ctx.$location.path('/test');
      ctx.scope.panel = { id: 22 };

      ctx.scope.init();
      expect(ctx.scope.shareUrl).to.be('http://server/#!/test?from=1000&to=2000&orgId=1&panelId=22&fullscreen');
    });

    it('should generate render url', function() {
      ctx.$location.$$absUrl = 'http://dashboards.grafana.com/d/abcdefghi/my-dash';

      ctx.scope.panel = { id: 22 };

      ctx.scope.init();
      var base = 'http://dashboards.grafana.com/render/d-solo/abcdefghi/my-dash';
      var params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
      expect(ctx.scope.imageUrl).to.contain(base + params);
    });

    it('should generate render url for scripted dashboard', function() {
      ctx.$location.$$absUrl = 'http://dashboards.grafana.com/dashboard/script/my-dash.js';

      ctx.scope.panel = { id: 22 };

      ctx.scope.init();
      var base = 'http://dashboards.grafana.com/render/dashboard-solo/script/my-dash.js';
      var params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
      expect(ctx.scope.imageUrl).to.contain(base + params);
    });

    it('should remove panel id when no panel in scope', function() {
      ctx.$location.path('/test');
      ctx.scope.options.forCurrent = true;
      ctx.scope.panel = null;

      ctx.scope.init();
      expect(ctx.scope.shareUrl).to.be('http://server/#!/test?from=1000&to=2000&orgId=1');
    });

    it('should add theme when specified', function() {
      ctx.$location.path('/test');
      ctx.scope.options.theme = 'light';
      ctx.scope.panel = null;

      ctx.scope.init();
      expect(ctx.scope.shareUrl).to.be('http://server/#!/test?from=1000&to=2000&orgId=1&theme=light');
    });

    it('should remove fullscreen from image url when is first param in querystring and modeSharePanel is true', function() {
      ctx.$location.url('/test?fullscreen&edit');
      ctx.scope.modeSharePanel = true;
      ctx.scope.panel = { id: 1 };

      ctx.scope.buildUrl();

      expect(ctx.scope.shareUrl).to.contain('?fullscreen&edit&from=1000&to=2000&orgId=1&panelId=1');
      expect(ctx.scope.imageUrl).to.contain('?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&tz=UTC');
    });

    it('should remove edit from image url when is first param in querystring and modeSharePanel is true', function() {
      ctx.$location.url('/test?edit&fullscreen');
      ctx.scope.modeSharePanel = true;
      ctx.scope.panel = { id: 1 };

      ctx.scope.buildUrl();

      expect(ctx.scope.shareUrl).to.contain('?edit&fullscreen&from=1000&to=2000&orgId=1&panelId=1');
      expect(ctx.scope.imageUrl).to.contain('?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&tz=UTC');
    });

    it('should include template variables in url', function() {
      ctx.$location.path('/test');
      ctx.scope.options.includeTemplateVars = true;

      ctx.templateSrv.fillVariableValuesForUrl = function(params) {
        params['var-app'] = 'mupp';
        params['var-server'] = 'srv-01';
      };

      ctx.scope.buildUrl();
      expect(ctx.scope.shareUrl).to.be(
        'http://server/#!/test?from=1000&to=2000&orgId=1&var-app=mupp&var-server=srv-01'
      );
    });
  });
});

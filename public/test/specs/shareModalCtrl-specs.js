define([
  './helpers',
  'app/features/dashboard/shareModalCtrl',
  'app/features/panellinks/linkSrv',
], function(helpers) {
  'use strict';

  describe('ShareModalCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    function setTime(range) {
      ctx.timeSrv.timeRange = sinon.stub().returns(range);
    }

    setTime({ from: new Date(1000), to: new Date(2000) });

    beforeEach(module('grafana.controllers'));
    beforeEach(module('grafana.services'));

    beforeEach(ctx.providePhase());

    beforeEach(ctx.createControllerPhase('ShareModalCtrl'));

    describe('shareUrl with current time range and panel', function() {

      it('should generate share url absolute time', function() {
        ctx.$location.path('/test');
        ctx.scope.panel = { id: 22 };

        ctx.scope.init();
        expect(ctx.scope.shareUrl).to.be('http://server/#/test?from=1000&to=2000&panelId=22&fullscreen');
      });

      it('should generate render url', function() {
        ctx.$location.$$absUrl = 'http://dashboards.grafana.com/dashboard/db/my-dash';

        ctx.scope.panel = { id: 22 };

        ctx.scope.init();
        var base = 'http://dashboards.grafana.com/render/dashboard-solo/db/my-dash';
        var params = '?from=1000&to=2000&panelId=22&fullscreen&width=1000&height=500';
        expect(ctx.scope.imageUrl).to.be(base + params);
      });

      it('should remove panel id when no panel in scope', function() {
        ctx.$location.path('/test');
        ctx.scope.options.forCurrent = true;
        ctx.scope.panel = null;

        ctx.scope.init();
        expect(ctx.scope.shareUrl).to.be('http://server/#/test?from=1000&to=2000');
      });

      it('should add theme when specified', function() {
        ctx.$location.path('/test');
        ctx.scope.options.theme = 'light';
        ctx.scope.panel = null;

        ctx.scope.init();
        expect(ctx.scope.shareUrl).to.be('http://server/#/test?from=1000&to=2000&theme=light');
      });

      it('should include template variables in url', function() {
        ctx.$location.path('/test');
        ctx.scope.options.includeTemplateVars = true;

        ctx.templateSrv.fillVariableValuesForUrl = function(params) {
          params['var-app'] = 'mupp';
          params['var-server'] = 'srv-01';
        };

        ctx.scope.buildUrl();
        expect(ctx.scope.shareUrl).to.be('http://server/#/test?from=1000&to=2000&var-app=mupp&var-server=srv-01');
      });

    });

  });

});


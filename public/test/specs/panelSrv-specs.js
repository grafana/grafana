define([
  './helpers',
  'app/features/panel/panel_srv',
], function() {
  'use strict';

  describe('PanelSrv', function() {
    var _panelSrv;
    var _panelScope;
    var _datasourceSrvStub;

    beforeEach(module('grafana.services'));
    beforeEach(module(function($provide) {
      _datasourceSrvStub = {
        getMetricSources: sinon.spy(),
      };
      $provide.value('datasourceSrv', _datasourceSrvStub);
    }));

    beforeEach(inject(function(panelSrv, $rootScope) {
      _panelSrv = panelSrv;
      _panelScope = $rootScope.$new();
      _panelScope.panel = {
        targets: [],
      };
      _panelScope.dashboardViewState = {
        registerPanel: sinon.spy(),
      };
    }));

    describe('init', function() {
      beforeEach(function() {
        _panelSrv.init(_panelScope);
      });

    });
  });

});


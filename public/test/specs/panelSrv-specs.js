define([
  'helpers',
  'features/panel/panelSrv',
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

      describe('addDataQuery', function() {
        it('should add target', function() {
          _panelScope.addDataQuery();
          expect(_panelScope.panel.targets.length).to.be(1);
        });

        it('should set refId', function() {
          _panelScope.addDataQuery();
          expect(_panelScope.panel.targets[0].refId).to.be('A');
        });

        it('should set refId to first available letter', function() {
          _panelScope.panel.targets = [{refId: 'A'}];
          _panelScope.addDataQuery();
          expect(_panelScope.panel.targets[1].refId).to.be('B');
        });
      });

    });
  });

});


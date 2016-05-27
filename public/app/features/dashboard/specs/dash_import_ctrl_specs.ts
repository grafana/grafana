import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import {DashImportCtrl} from 'app/features/dashboard/import/dash_import';
import config from 'app/core/config';

describe('DashImportCtrl', function() {
  var ctx: any = {};
  var backendSrv = {
    search: sinon.stub().returns(Promise.resolve([])),
    get: sinon.stub()
  };

  beforeEach(angularMocks.module('grafana.core'));

  beforeEach(angularMocks.inject(($rootScope, $controller, $q) => {
    ctx.$q = $q;
    ctx.scope = $rootScope.$new();
    ctx.ctrl = $controller(DashImportCtrl, {
      $scope: ctx.scope,
      backendSrv: backendSrv,
    });
  }));

  describe('when uploading json', function() {
    beforeEach(function() {
      config.datasources = {
        ds: {
          type: 'test-db',
        }
      };

      ctx.ctrl.onUpload({
        '__inputs': [
          {name: 'ds', pluginId: 'test-db', type: 'datasource', pluginName: 'Test DB'}
        ]
      });
    });

    it('should build input model', function() {
      expect(ctx.ctrl.inputs.length).to.eql(1);
      expect(ctx.ctrl.inputs[0].name).to.eql('ds');
      expect(ctx.ctrl.inputs[0].info).to.eql('Select a Test DB data source');
    });

    it('should set inputValid to false', function() {
      expect(ctx.ctrl.inputsValid).to.eql(false);
    });
  });

  describe('when specifing grafana.net url', function() {
    beforeEach(function() {
      ctx.ctrl.gnetUrl = 'http://grafana.net/dashboards/123';
      // setup api mock
      backendSrv.get = sinon.spy(() => {
        return Promise.resolve({
        });
      });
      ctx.ctrl.checkGnetDashboard();
    });

    it('should call gnet api with correct dashboard id', function() {
      expect(backendSrv.get.getCall(0).args[0]).to.eql('api/gnet/dashboards/123');
    });
  });

  describe('when specifing dashbord id', function() {
    beforeEach(function() {
      ctx.ctrl.gnetUrl = '2342';
      // setup api mock
      backendSrv.get = sinon.spy(() => {
        return Promise.resolve({
        });
      });
      ctx.ctrl.checkGnetDashboard();
    });

    it('should call gnet api with correct dashboard id', function() {
      expect(backendSrv.get.getCall(0).args[0]).to.eql('api/gnet/dashboards/2342');
    });
  });

});



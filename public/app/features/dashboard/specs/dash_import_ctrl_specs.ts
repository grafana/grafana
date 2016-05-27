import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import {DashImportCtrl} from 'app/features/dashboard/import/dash_import';
import config from 'app/core/config';

describe('DashImportCtrl', function() {
  var ctx: any = {};
  var backendSrv = {
    search: sinon.stub().returns(Promise.resolve([])),
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

  describe('when upload json', function() {
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
      expect(ctx.ctrl.inputs[0].label).to.eql(1);
    });

    it('should set inputValid to false', function() {
      expect(ctx.ctrl.inputsValid).to.eql(false);
    });

  });
});



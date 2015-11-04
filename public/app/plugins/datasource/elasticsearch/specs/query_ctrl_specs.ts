///<amd-dependency path="../query_ctrl" />
///<amd-dependency path="app/services/uiSegmentSrv" />
///<amd-dependency path="test/specs/helpers" name="helpers" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

declare var helpers: any;

describe('ElasticQueryCtrl', function() {
  var ctx = new helpers.ControllerTestContext();

  beforeEach(angularMocks.module('grafana.controllers'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(ctx.providePhase());
  beforeEach(ctx.createControllerPhase('ElasticQueryCtrl'));

  beforeEach(function() {
    ctx.scope.target = {};
    ctx.scope.$parent = { get_data: sinon.spy() };

    ctx.scope.datasource = ctx.datasource;
    ctx.scope.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([]));
  });

  describe('init', function() {
    beforeEach(function() {
      ctx.scope.init();
    });
  });
});

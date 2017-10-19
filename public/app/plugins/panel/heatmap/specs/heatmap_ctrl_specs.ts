///<reference path="../../../../headers/common.d.ts" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from '../../../../../test/lib/common';

import angular from 'angular';
import moment from 'moment';
import {HeatmapCtrl} from '../heatmap_ctrl';
import helpers from '../../../../../test/specs/helpers';

describe('HeatmapCtrl', function() {
  var ctx = new helpers.ControllerTestContext();

  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.module('grafana.controllers'));
  beforeEach(angularMocks.module(function($compileProvider) {
    $compileProvider.preAssignBindingsEnabled(true);
  }));

  beforeEach(ctx.providePhase());
  beforeEach(ctx.createPanelController(HeatmapCtrl));
  beforeEach(() => {
    ctx.ctrl.annotationsPromise = Promise.resolve({});
    ctx.ctrl.updateTimeRange();
  });

  describe('when time series are outside range', function() {

    beforeEach(function() {
      var data = [
        {target: 'test.cpu1', datapoints: [[45, 1234567890], [60, 1234567899]]},
      ];

      ctx.ctrl.range = {from: moment().valueOf(), to: moment().valueOf()};
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsOutside', function() {
      expect(ctx.ctrl.dataWarning.title).to.be('Data points outside time range');
    });
  });

  describe('when time series are inside range', function() {
    beforeEach(function() {
      var range = {
        from: moment().subtract(1, 'days').valueOf(),
        to: moment().valueOf()
      };

      var data = [
        {target: 'test.cpu1', datapoints: [[45, range.from + 1000], [60, range.from + 10000]]},
      ];

      ctx.ctrl.range = range;
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsOutside', function() {
      expect(ctx.ctrl.dataWarning).to.be(null);
    });
  });

  describe('datapointsCount given 2 series', function() {
    beforeEach(function() {
      var data = [
        {target: 'test.cpu1', datapoints: []},
        {target: 'test.cpu2', datapoints: []},
      ];
      ctx.ctrl.onDataReceived(data);
    });

    it('should set datapointsCount warning', function() {
      expect(ctx.ctrl.dataWarning.title).to.be('No data points');
    });
  });

});

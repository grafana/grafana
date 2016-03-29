///<reference path="../../../../headers/common.d.ts" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from '../../../../../test/lib/common';

import angular from 'angular';
import {GraphCtrl} from '../module';
import helpers from '../../../../../test/specs/helpers';

describe('GraphCtrl', function() {
  var ctx = new helpers.ControllerTestContext();

  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.module('grafana.controllers'));

  beforeEach(ctx.providePhase());
  beforeEach(ctx.createPanelController(GraphCtrl));
  beforeEach(() => {
    ctx.ctrl.annotationsPromise = Promise.resolve({});
    ctx.ctrl.updateTimeRange();
  });

  describe('msResolution with second resolution timestamps', function() {
    beforeEach(function() {
      var data = [
        { target: 'test.cpu1', datapoints: [[1234567890, 45], [1234567899, 60]]},
        { target: 'test.cpu2', datapoints: [[1236547890, 55], [1234456709, 90]]}
      ];
      ctx.ctrl.panel.tooltip.msResolution = false;
      ctx.ctrl.onDataReceived(data);
    });

    it('should not show millisecond resolution tooltip', function() {
      expect(ctx.ctrl.panel.tooltip.msResolution).to.be(false);
    });
  });

  describe('msResolution with millisecond resolution timestamps', function() {
    beforeEach(function() {
      var data = [
        { target: 'test.cpu1', datapoints: [[1234567890000, 45], [1234567899000, 60]]},
        { target: 'test.cpu2', datapoints: [[1236547890001, 55], [1234456709000, 90]]}
      ];
      ctx.ctrl.panel.tooltip.msResolution = false;
      ctx.ctrl.onDataReceived(data);
    });

    it('should show millisecond resolution tooltip', function() {
      expect(ctx.ctrl.panel.tooltip.msResolution).to.be(true);
    });
  });

  describe('msResolution with millisecond resolution timestamps but with trailing zeroes', function() {
    beforeEach(function() {
      var data = [
        { target: 'test.cpu1', datapoints: [[1234567890000, 45], [1234567899000, 60]]},
        { target: 'test.cpu2', datapoints: [[1236547890000, 55], [1234456709000, 90]]}
      ];
      ctx.ctrl.panel.tooltip.msResolution = false;
      ctx.ctrl.onDataReceived(data);
    });

    it('should not show millisecond resolution tooltip', function() {
      expect(ctx.ctrl.panel.tooltip.msResolution).to.be(false);
    });
  });

  describe('msResolution with millisecond resolution timestamps in one of the series', function() {
    beforeEach(function() {
      var data = [
        { target: 'test.cpu1', datapoints: [[1234567890000, 45], [1234567899000, 60]]},
        { target: 'test.cpu2', datapoints: [[1236547890010, 55], [1234456709000, 90]]},
        { target: 'test.cpu3', datapoints: [[1236547890000, 65], [1234456709000, 120]]}
      ];
      ctx.ctrl.panel.tooltip.msResolution = false;
      ctx.ctrl.onDataReceived(data);
    });

    it('should show millisecond resolution tooltip', function() {
      expect(ctx.ctrl.panel.tooltip.msResolution).to.be(true);
    });
  });

});

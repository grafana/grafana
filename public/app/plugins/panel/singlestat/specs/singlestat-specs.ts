///<reference path="../../../../headers/common.d.ts" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from '../../../../../test/lib/common';

import angular from 'angular';
import helpers from '../../../../../test/specs/helpers';
import {SingleStatCtrl} from '../module';

describe('SingleStatCtrl', function() {
  var ctx = new helpers.ControllerTestContext();

  function singleStatScenario(desc, func) {

    describe(desc, function() {

      ctx.setup = function (setupFunc) {

        beforeEach(angularMocks.module('grafana.services'));
        beforeEach(angularMocks.module('grafana.controllers'));

        beforeEach(ctx.providePhase());
        beforeEach(ctx.createPanelController(SingleStatCtrl));

        beforeEach(function() {
          setupFunc();
          var data = [
            {target: 'test.cpu1', datapoints: ctx.datapoints}
          ];

          ctx.ctrl.onDataReceived(data);
          ctx.data = ctx.ctrl.data;
        });
      };

      func(ctx);
    });
  }

  singleStatScenario('with defaults', function(ctx) {
    ctx.setup(function() {
      ctx.datapoints = [[10,1], [20,2]];
    });

    it('Should use series avg as default main value', function() {
      expect(ctx.data.value).to.be(15);
      expect(ctx.data.valueRounded).to.be(15);
    });

    it('should set formated falue', function() {
      expect(ctx.data.valueFormated).to.be('15');
    });
  });

  singleStatScenario('showing serie name instead of value', function(ctx) {
    ctx.setup(function() {
      ctx.datapoints = [[10,1], [20,2]];
      ctx.ctrl.panel.valueName = 'name';
    });

    it('Should use series avg as default main value', function() {
      expect(ctx.data.value).to.be(0);
      expect(ctx.data.valueRounded).to.be(0);
    });

    it('should set formated falue', function() {
      expect(ctx.data.valueFormated).to.be('test.cpu1');
    });
  });

  singleStatScenario('MainValue should use same number for decimals as displayed when checking thresholds', function(ctx) {
    ctx.setup(function() {
      ctx.datapoints = [[99.999,1], [99.99999,2]];
    });

    it('Should be rounded', function() {
      expect(ctx.data.value).to.be(99.999495);
      expect(ctx.data.valueRounded).to.be(100);
    });

    it('should set formated falue', function() {
      expect(ctx.data.valueFormated).to.be('100');
    });
  });

  singleStatScenario('When value to text mapping is specified', function(ctx) {
    ctx.setup(function() {
      ctx.datapoints = [[9.9,1]];
      ctx.ctrl.panel.valueMaps = [{value: '10', text: 'OK'}];
    });

    it('value should remain', function() {
      expect(ctx.data.value).to.be(9.9);
    });

    it('round should be rounded up', function() {
      expect(ctx.data.valueRounded).to.be(10);
    });

    it('Should replace value with text', function() {
      expect(ctx.data.valueFormated).to.be('OK');
    });
  });

  singleStatScenario('When range to text mapping is specifiedfor first range', function(ctx) {
    ctx.setup(function() {
      ctx.datapoints = [[41,50]];
      ctx.ctrl.panel.mappingType = 2;
      ctx.ctrl.panel.rangeMaps = [{from: '10', to: '50', text: 'OK'},{from: '51', to: '100', text: 'NOT OK'}];
    });

    it('Should replace value with text OK', function() {
      expect(ctx.data.valueFormated).to.be('OK');
    });
  });

  singleStatScenario('When range to text mapping is specified for other ranges', function(ctx) {
    ctx.setup(function() {
      ctx.datapoints = [[65,75]];
      ctx.ctrl.panel.mappingType = 2;
      ctx.ctrl.panel.rangeMaps = [{from: '10', to: '50', text: 'OK'},{from: '51', to: '100', text: 'NOT OK'}];
    });

    it('Should replace value with text NOT OK', function() {
      expect(ctx.data.valueFormated).to.be('NOT OK');
    });
  });

});

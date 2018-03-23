import { describe, beforeEach, afterEach, it, sinon, expect, angularMocks } from 'test/lib/common';

import helpers from 'test/specs/helpers';
import { SingleStatCtrl } from '../module';
import moment from 'moment';

describe('SingleStatCtrl', function() {
  var ctx = new helpers.ControllerTestContext();
  var epoch = 1505826363746;
  var clock;

  function singleStatScenario(desc, func) {
    describe(desc, function() {
      ctx.setup = function(setupFunc) {
        beforeEach(angularMocks.module('grafana.services'));
        beforeEach(angularMocks.module('grafana.controllers'));
        beforeEach(
          angularMocks.module(function($compileProvider) {
            $compileProvider.preAssignBindingsEnabled(true);
          })
        );

        beforeEach(ctx.providePhase());
        beforeEach(ctx.createPanelController(SingleStatCtrl));

        beforeEach(function() {
          setupFunc();
          ctx.ctrl.onDataReceived(ctx.data);
          ctx.data = ctx.ctrl.data;
        });
      };

      func(ctx);
    });
  }

  singleStatScenario('with defaults', function(ctx) {
    ctx.setup(function() {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 1], [20, 2]] }];
    });

    it('Should use series avg as default main value', function() {
      expect(ctx.data.value).to.be(15);
      expect(ctx.data.valueRounded).to.be(15);
    });

    it('should set formatted falue', function() {
      expect(ctx.data.valueFormatted).to.be('15');
    });
  });

  singleStatScenario('showing serie name instead of value', function(ctx) {
    ctx.setup(function() {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 1], [20, 2]] }];
      ctx.ctrl.panel.valueName = 'name';
    });

    it('Should use series avg as default main value', function() {
      expect(ctx.data.value).to.be(0);
      expect(ctx.data.valueRounded).to.be(0);
    });

    it('should set formatted value', function() {
      expect(ctx.data.valueFormatted).to.be('test.cpu1');
    });
  });

  singleStatScenario('showing last iso time instead of value', function(ctx) {
    ctx.setup(function() {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 12], [20, 1505634997920]] }];
      ctx.ctrl.panel.valueName = 'last_time';
      ctx.ctrl.panel.format = 'dateTimeAsIso';
    });

    it('Should use time instead of value', function() {
      expect(ctx.data.value).to.be(1505634997920);
      expect(ctx.data.valueRounded).to.be(1505634997920);
    });

    it('should set formatted value', function() {
      expect(ctx.data.valueFormatted).to.be(moment(1505634997920).format('YYYY-MM-DD HH:mm:ss'));
    });
  });

  singleStatScenario('showing last us time instead of value', function(ctx) {
    ctx.setup(function() {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 12], [20, 1505634997920]] }];
      ctx.ctrl.panel.valueName = 'last_time';
      ctx.ctrl.panel.format = 'dateTimeAsUS';
    });

    it('Should use time instead of value', function() {
      expect(ctx.data.value).to.be(1505634997920);
      expect(ctx.data.valueRounded).to.be(1505634997920);
    });

    it('should set formatted value', function() {
      expect(ctx.data.valueFormatted).to.be(moment(1505634997920).format('MM/DD/YYYY h:mm:ss a'));
    });
  });

  singleStatScenario('showing last time from now instead of value', function(ctx) {
    beforeEach(() => {
      clock = sinon.useFakeTimers(epoch);
    });

    ctx.setup(function() {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 12], [20, 1505634997920]] }];
      ctx.ctrl.panel.valueName = 'last_time';
      ctx.ctrl.panel.format = 'dateTimeFromNow';
    });

    it('Should use time instead of value', function() {
      expect(ctx.data.value).to.be(1505634997920);
      expect(ctx.data.valueRounded).to.be(1505634997920);
    });

    it('should set formatted value', function() {
      expect(ctx.data.valueFormatted).to.be('2 days ago');
    });

    afterEach(() => {
      clock.restore();
    });
  });

  singleStatScenario('MainValue should use same number for decimals as displayed when checking thresholds', function(
    ctx
  ) {
    ctx.setup(function() {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[99.999, 1], [99.99999, 2]] }];
    });

    it('Should be rounded', function() {
      expect(ctx.data.value).to.be(99.999495);
      expect(ctx.data.valueRounded).to.be(100);
    });

    it('should set formatted value', function() {
      expect(ctx.data.valueFormatted).to.be('100');
    });
  });

  singleStatScenario('When value to text mapping is specified', function(ctx) {
    ctx.setup(function() {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[9.9, 1]] }];
      ctx.ctrl.panel.valueMaps = [{ value: '10', text: 'OK' }];
    });

    it('value should remain', function() {
      expect(ctx.data.value).to.be(9.9);
    });

    it('round should be rounded up', function() {
      expect(ctx.data.valueRounded).to.be(10);
    });

    it('Should replace value with text', function() {
      expect(ctx.data.valueFormatted).to.be('OK');
    });
  });

  singleStatScenario('When range to text mapping is specified for first range', function(ctx) {
    ctx.setup(function() {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[41, 50]] }];
      ctx.ctrl.panel.mappingType = 2;
      ctx.ctrl.panel.rangeMaps = [{ from: '10', to: '50', text: 'OK' }, { from: '51', to: '100', text: 'NOT OK' }];
    });

    it('Should replace value with text OK', function() {
      expect(ctx.data.valueFormatted).to.be('OK');
    });
  });

  singleStatScenario('When range to text mapping is specified for other ranges', function(ctx) {
    ctx.setup(function() {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[65, 75]] }];
      ctx.ctrl.panel.mappingType = 2;
      ctx.ctrl.panel.rangeMaps = [{ from: '10', to: '50', text: 'OK' }, { from: '51', to: '100', text: 'NOT OK' }];
    });

    it('Should replace value with text NOT OK', function() {
      expect(ctx.data.valueFormatted).to.be('NOT OK');
    });
  });

  describe('When table data', function() {
    const tableData = [
      {
        columns: [{ text: 'Time', type: 'time' }, { text: 'test1' }, { text: 'mean' }, { text: 'test2' }],
        rows: [[1492759673649, 'ignore1', 15, 'ignore2']],
        type: 'table',
      },
    ];

    singleStatScenario('with default values', function(ctx) {
      ctx.setup(function() {
        ctx.data = tableData;
        ctx.ctrl.panel.tableColumn = 'mean';
      });

      it('Should use first rows value as default main value', function() {
        expect(ctx.data.value).to.be(15);
        expect(ctx.data.valueRounded).to.be(15);
      });

      it('should set formatted value', function() {
        expect(ctx.data.valueFormatted).to.be('15');
      });
    });

    singleStatScenario('When table data has multiple columns', function(ctx) {
      ctx.setup(function() {
        ctx.data = tableData;
        ctx.ctrl.panel.tableColumn = '';
      });

      it('Should set column to first column that is not time', function() {
        expect(ctx.ctrl.panel.tableColumn).to.be('test1');
      });
    });

    singleStatScenario('MainValue should use same number for decimals as displayed when checking thresholds', function(
      ctx
    ) {
      ctx.setup(function() {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 99.99999, 'ignore2'];
        ctx.ctrl.panel.tableColumn = 'mean';
      });

      it('Should be rounded', function() {
        expect(ctx.data.value).to.be(99.99999);
        expect(ctx.data.valueRounded).to.be(100);
      });

      it('should set formatted falue', function() {
        expect(ctx.data.valueFormatted).to.be('100');
      });
    });

    singleStatScenario('When value to text mapping is specified', function(ctx) {
      ctx.setup(function() {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 9.9, 'ignore2'];
        ctx.ctrl.panel.tableColumn = 'mean';
        ctx.ctrl.panel.valueMaps = [{ value: '10', text: 'OK' }];
      });

      it('value should remain', function() {
        expect(ctx.data.value).to.be(9.9);
      });

      it('round should be rounded up', function() {
        expect(ctx.data.valueRounded).to.be(10);
      });

      it('Should replace value with text', function() {
        expect(ctx.data.valueFormatted).to.be('OK');
      });
    });

    singleStatScenario('When range to text mapping is specified for first range', function(ctx) {
      ctx.setup(function() {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 41, 'ignore2'];
        ctx.ctrl.panel.tableColumn = 'mean';
        ctx.ctrl.panel.mappingType = 2;
        ctx.ctrl.panel.rangeMaps = [{ from: '10', to: '50', text: 'OK' }, { from: '51', to: '100', text: 'NOT OK' }];
      });

      it('Should replace value with text OK', function() {
        expect(ctx.data.valueFormatted).to.be('OK');
      });
    });

    singleStatScenario('When range to text mapping is specified for other ranges', function(ctx) {
      ctx.setup(function() {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 65, 'ignore2'];
        ctx.ctrl.panel.tableColumn = 'mean';
        ctx.ctrl.panel.mappingType = 2;
        ctx.ctrl.panel.rangeMaps = [{ from: '10', to: '50', text: 'OK' }, { from: '51', to: '100', text: 'NOT OK' }];
      });

      it('Should replace value with text NOT OK', function() {
        expect(ctx.data.valueFormatted).to.be('NOT OK');
      });
    });

    singleStatScenario('When value is string', function(ctx) {
      ctx.setup(function() {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 65, 'ignore2'];
        ctx.ctrl.panel.tableColumn = 'test1';
      });

      it('Should replace value with text NOT OK', function() {
        expect(ctx.data.valueFormatted).to.be('ignore1');
      });
    });

    singleStatScenario('When value is zero', function(ctx) {
      ctx.setup(function() {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 0, 'ignore2'];
        ctx.ctrl.panel.tableColumn = 'mean';
      });

      it('Should return zero', function() {
        expect(ctx.data.value).to.be(0);
      });
    });
  });
});

define([
  'mocks/dashboard-mock',
  'underscore',
  'services/filterSrv'
], function(dashboardMock, _) {
  'use strict';

  describe('filterSrv', function() {
    var _filterSrv;
    var _dashboard;

    beforeEach(module('kibana.services'));
    beforeEach(module(function($provide){
      _dashboard = dashboardMock.create();
      $provide.value('dashboard', _dashboard);
    }));

    beforeEach(inject(function(filterSrv) {
      _filterSrv = filterSrv;
    }));

    beforeEach(function() {
      _filterSrv.init(_dashboard.current);
    });

    describe('init', function() {
      beforeEach(function() {
        _filterSrv.addTemplateParameter({ name: 'test', current: { value: 'oogle' } });
      });

      it('should initialize template data', function() {
        var target = _filterSrv.applyTemplateToTarget('this.[[test]].filters');
        expect(target).to.be('this.oogle.filters');
      });
    });

    describe('updateTemplateData', function() {
      beforeEach(function() {
        _filterSrv.addTemplateParameter({
          name: 'test',
          value: 'muuu',
          current: { value: 'muuuu' }
        });

        _filterSrv.updateTemplateData();
      });
      it('should set current value and update template data', function() {
        var target = _filterSrv.applyTemplateToTarget('this.[[test]].filters');
        expect(target).to.be('this.muuuu.filters');
      });
    });

    describe('timeRange', function() {
      it('should return unparsed when parse is false', function() {
        _filterSrv.setTime({from: 'now', to: 'now-1h' });
        var time = _filterSrv.timeRange(false);
        expect(time.from).to.be('now');
        expect(time.to).to.be('now-1h');
      });

      it('should return parsed when parse is true', function() {
        _filterSrv.setTime({from: 'now', to: 'now-1h' });
        var time = _filterSrv.timeRange(true);
        expect(_.isDate(time.from)).to.be(true);
        expect(_.isDate(time.to)).to.be(true);
      });
    });

    describe('setTime', function() {
      it('should return disable refresh for absolute times', function() {
        _dashboard.current.refresh = true;

        _filterSrv.setTime({from: '2011-01-01', to: '2015-01-01' });
        expect(_dashboard.current.refresh).to.be(false);
      });

      it('should restore refresh after relative time range is set', function() {
        _dashboard.current.refresh = true;
        _filterSrv.setTime({from: '2011-01-01', to: '2015-01-01' });
        expect(_dashboard.current.refresh).to.be(false);
        _filterSrv.setTime({from: '2011-01-01', to: 'now' });
        expect(_dashboard.current.refresh).to.be(true);
      });
    });

  });

});

import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import helpers from 'test/specs/helpers';
import _ from 'lodash';
import TimeSrv from '../time_srv';
import moment from 'moment';

describe('timeSrv', function() {
  var ctx = new helpers.ServiceTestContext();
  var _dashboard: any = {
    time: {from: 'now-6h', to: 'now'},
  };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(ctx.createService('timeSrv'));

  beforeEach(function() {
    ctx.service.init(_dashboard);
  });

  describe('timeRange', function() {
    it('should return unparsed when parse is false', function() {
      ctx.service.setTime({from: 'now', to: 'now-1h' });
      var time = ctx.service.timeRange();
      expect(time.raw.from).to.be('now');
      expect(time.raw.to).to.be('now-1h');
    });

    it('should return parsed when parse is true', function() {
      ctx.service.setTime({from: 'now', to: 'now-1h' });
      var time = ctx.service.timeRange();
      expect(moment.isMoment(time.from)).to.be(true);
      expect(moment.isMoment(time.to)).to.be(true);
    });
  });

  describe('init time from url', function() {
    it('should handle relative times', function() {
      ctx.$location.search({from: 'now-2d', to: 'now'});
      ctx.service.init(_dashboard);
      var time = ctx.service.timeRange();
      expect(time.raw.from).to.be('now-2d');
      expect(time.raw.to).to.be('now');
    });

    it('should handle formated dates', function() {
      ctx.$location.search({from: '20140410T052010', to: '20140520T031022'});
      ctx.service.init(_dashboard);
      var time = ctx.service.timeRange(true);
      expect(time.from.valueOf()).to.equal(new Date("2014-04-10T05:20:10Z").getTime());
      expect(time.to.valueOf()).to.equal(new Date("2014-05-20T03:10:22Z").getTime());
    });

    it('should handle formated dates without time', function() {
      ctx.$location.search({from: '20140410', to: '20140520'});
      ctx.service.init(_dashboard);
      var time = ctx.service.timeRange(true);
      expect(time.from.valueOf()).to.equal(new Date("2014-04-10T00:00:00Z").getTime());
      expect(time.to.valueOf()).to.equal(new Date("2014-05-20T00:00:00Z").getTime());
    });

    it('should handle epochs', function() {
      ctx.$location.search({from: '1410337646373', to: '1410337665699'});
      ctx.service.init(_dashboard);
      var time = ctx.service.timeRange(true);
      expect(time.from.valueOf()).to.equal(1410337646373);
      expect(time.to.valueOf()).to.equal(1410337665699);
    });

    it('should handle bad dates', function() {
      ctx.$location.search({from: '20151126T00010%3C%2Fp%3E%3Cspan%20class', to: 'now'});
      _dashboard.time.from = 'now-6h';
      ctx.service.init(_dashboard);
      expect(ctx.service.time.from).to.equal('now-6h');
      expect(ctx.service.time.to).to.equal('now');
    });
  });

  describe('setTime', function() {
    it('should return disable refresh if refresh is disabled for any range', function() {
      _dashboard.refresh = false;

      ctx.service.setTime({from: '2011-01-01', to: '2015-01-01' });
      expect(_dashboard.refresh).to.be(false);
    });

    it('should restore refresh for absolute time range', function() {
      _dashboard.refresh = '30s';

      ctx.service.setTime({from: '2011-01-01', to: '2015-01-01' });
      expect(_dashboard.refresh).to.be('30s');
    });

    it('should restore refresh after relative time range is set', function() {
      _dashboard.refresh = '10s';
      ctx.service.setTime({from: moment([2011,1,1]), to: moment([2015,1,1])});
      expect(_dashboard.refresh).to.be(false);
      ctx.service.setTime({from: '2011-01-01', to: 'now' });
      expect(_dashboard.refresh).to.be('10s');
    });

    it('should keep refresh after relative time range is changed and now delay exists', function() {
      _dashboard.refresh = '10s';
      ctx.service.setTime({from: 'now-1h', to: 'now-10s' });
      expect(_dashboard.refresh).to.be('10s');
    });
  });

});

import {describe, beforeEach, it, sinon, expect} from 'test/lib/common'

import rangeUtil = require('app/core/utils/rangeutil')
import _  = require('lodash')
import moment  = require('moment')

describe.only("rangeUtil", () => {

  describe("Can get range text described", () => {
    it('should handle simple old expression with only amount and unit', () => {
      var info = rangeUtil.describeTextRange('5m');
      expect(info.display).to.be('Last 5 minutes')
    });

    it('should have singular when amount is 1', () => {
      var info = rangeUtil.describeTextRange('1h');
      expect(info.display).to.be('Last 1 hour')
    });

    it('should handle non default amount', () => {
      var info = rangeUtil.describeTextRange('13h');
      expect(info.display).to.be('Last 13 hours')
      expect(info.from).to.be('now-13h')
    });

    it('should handle now/d', () => {
      var info = rangeUtil.describeTextRange('now/d');
      expect(info.display).to.be('The day so far');
    });

    it('should handle now/w', () => {
      var info = rangeUtil.describeTextRange('now/w');
      expect(info.display).to.be('Week to date');
    });
  });

  describe("Can get date range described", () => {
    it('Date range with simple ranges', () => {
      var text = rangeUtil.describeTimeRange({from: 'now-1h', to: 'now'});
      expect(text).to.be('Last 1 hour')
    });

    it('Date range with absolute to now', () => {
      var text = rangeUtil.describeTimeRange({from: moment([2014,10,10,2,3,4]), to: 'now'});
      expect(text).to.be('Nov 10, 2014 02:03:04 to a few seconds ago')
    });

    it('Date range with absolute to relative', () => {
      var text = rangeUtil.describeTimeRange({from: moment([2014,10,10,2,3,4]), to: 'now-1d'});
      expect(text).to.be('Nov 10, 2014 02:03:04 to a day ago')
    });

    it('Date range with relative to absolute', () => {
      var text = rangeUtil.describeTimeRange({from: 'now-7d', to: moment([2014,10,10,2,3,4])});
      expect(text).to.be('7 days ago to Nov 10, 2014 02:03:04')
    });

    it('Date range with non matching default ranges', () => {
      var text = rangeUtil.describeTimeRange({from: 'now-13h', to: 'now'});
      expect(text).to.be('Last 13 hours')
    });
  });

});

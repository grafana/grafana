import {describe, beforeEach, it, sinon, expect} from 'test/lib/common'

import * as dateMath from 'app/core/utils/datemath';
import * as _ from 'lodash';
import moment from 'moment';

describe("DateMath", () => {
  var spans = ['s', 'm', 'h', 'd', 'w', 'M', 'y'];
  var anchor =  '2014-01-01T06:06:06.666Z';
  var unix = moment(anchor).valueOf();
  var format = 'YYYY-MM-DDTHH:mm:ss.SSSZ';
  var clock;

  describe('errors', () => {
    it('should return undefined if passed something falsy', () => {
      expect(dateMath.parse(false)).to.be(undefined);
    });

    it('should return undefined if I pass an operator besides [+-/]', () => {
      expect(dateMath.parse('now&1d')).to.be(undefined);
    });

    it('should return undefined if I pass a unit besides' + spans.toString(), () => {
      expect(dateMath.parse('now+5f')).to.be(undefined);
    });

    it('should return undefined if rounding unit is not 1', () => {
      expect(dateMath.parse('now/2y')).to.be(undefined);
      expect(dateMath.parse('now/0.5y')).to.be(undefined);
    });

    it('should not go into an infinite loop when missing a unit', () => {
      expect(dateMath.parse('now-0')).to.be(undefined);
      expect(dateMath.parse('now-00')).to.be(undefined);
    });
  });

  it("now/d should set to start of current day", () => {
    var expected = new Date();
    expected.setHours(0);
    expected.setMinutes(0);
    expected.setSeconds(0);
    expected.setMilliseconds(0);

    var startOfDay = dateMath.parse('now/d', false).valueOf()
    expect(startOfDay).to.be(expected.getTime());
  });

  describe('subtraction', () => {
    var now;
    var anchored;

    beforeEach(() => {
      clock = sinon.useFakeTimers(unix);
      now = moment();
      anchored = moment(anchor);
    });

    _.each(spans, (span) => {
      var nowEx = 'now-5' + span;
      var thenEx =  anchor + '||-5' + span;

      it('should return 5' + span + ' ago', () => {
        expect(dateMath.parse(nowEx).format(format)).to.eql(now.subtract(5, span).format(format));
      });

      it('should return 5' + span + ' before ' + anchor, () => {
        expect(dateMath.parse(thenEx).format(format)).to.eql(anchored.subtract(5, span).format(format));
      });
    });
  });

  describe('rounding', () => {
    var now;
    var anchored;

    beforeEach(() => {
      clock = sinon.useFakeTimers(unix);
      now = moment();
      anchored = moment(anchor);
    });

    _.each(spans, (span) => {
      it('should round now to the beginning of the ' + span, function () {
        expect(dateMath.parse('now/' + span).format(format)).to.eql(now.startOf(span).format(format));
      });

      it('should round now to the end of the ' + span, function () {
        expect(dateMath.parse('now/' + span, true).format(format)).to.eql(now.endOf(span).format(format));
      });
    });
  });

  describe('isValid', () => {
    it('should return false when invalid date text', () => {
      expect(dateMath.isValid('asd')).to.be(false);
    });
    it('should return true when valid date text', () => {
      expect(dateMath.isValid('now-1h')).to.be(true);
    });
  });

  describe('relative time to date parsing', function() {
    it('should handle negative time', function() {
      var date = dateMath.parseDateMath('-2d', moment([2014, 1, 5]));
      expect(date.valueOf()).to.equal(moment([2014, 1, 3]).valueOf());
    });

    it('should handle multiple math expressions', function() {
      var date = dateMath.parseDateMath('-2d-6h', moment([2014, 1, 5]));
      expect(date.valueOf()).to.equal(moment([2014, 1, 2, 18]).valueOf());
    });

    it('should return false when invalid expression', function() {
      var date = dateMath.parseDateMath('2', moment([2014, 1, 5]));
      expect(date).to.equal(undefined);
    });
  });

});



import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {getColorForValue} from '../module';

describe('grafanaSingleStat', function() {
  describe('legacy thresholds', () => {
    describe('positive thresholds', () => {
      var data: any = {
        colorMap: ['green', 'yellow', 'red'],
        thresholds: [20, 50]
      };

      it('5 should return green', () => {
        expect(getColorForValue(data, 5)).to.be('green');
      });

      it('25 should return green', () => {
        expect(getColorForValue(data, 25)).to.be('yellow');
      });

      it('55 should return green', () => {
        expect(getColorForValue(data, 55)).to.be('red');
      });
    });
  });

  describe('negative thresholds', () => {
    var data: any = {
      colorMap: ['green', 'yellow', 'red'],
      thresholds: [ 0, 20]
    };

    it('-30 should return green', () => {
      expect(getColorForValue(data, -30)).to.be('green');
    });

    it('1 should return green', () => {
      expect(getColorForValue(data, 1)).to.be('yellow');
    });

    it('22 should return green', () => {
      expect(getColorForValue(data, 22)).to.be('red');
    });
  });

  describe('negative thresholds', () => {
    var data: any = {
      colorMap: ['green', 'yellow', 'red'],
      thresholds: [-27, 20]
    };

    it('-26 should return yellow', () => {
      expect(getColorForValue(data, -26)).to.be('yellow');
    });
  });

  describe('string thresholds', () => {
    var data: any = {
      colorMap : ['green', 'yellow', 'red'],
      thresholds : [/value1/, /value2/]
    };

    it('"other" should be green', () => {
      expect(getColorForValue(data, 'other')).to.be('green');
    });

    it('"value1" should be yellow', () => {
      expect(getColorForValue(data, 'value1')).to.be('yellow');
    });

    it('"value2" should be red', () => {
      expect(getColorForValue(data, 'value2')).to.be('red');
    });
  });

  describe('string thresholds with multiple matches', () => {
    var data: any = {
      colorMap : ['green', 'yellow', 'red'],
      thresholds : [/val/, /v.*/]
    };

    it('"other" should be green', () => {
      expect(getColorForValue(data, 'other')).to.be('green');
    });

    it('"value1" should be red', () => {
      expect(getColorForValue(data, 'value1')).to.be('red');
    });

    it('"victor" should be red', () => {
      expect(getColorForValue(data, 'victor')).to.be('red');
    });
  });
});

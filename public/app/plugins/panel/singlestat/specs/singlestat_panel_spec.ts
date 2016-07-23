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

    it('-30 should return green', () => {
      expect(getColorForValue(data, -26)).to.be('yellow');
    });
  });
});

///<amd-dependency path="../index_pattern" name="IndexPattern"/>
///<amd-dependency path="test/specs/helpers" name="helpers" />

import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';
import moment  = require('moment');

declare var IndexPattern: any;

describe('IndexPattern', function() {

  describe.only('when getting index for today', function() {
    it('should return correct index name', function() {
      var pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
      var expected = 'asd-' + moment().format('YYYY.MM.DD');

      expect(pattern.getIndexForToday()).to.be(expected);
    });
  });

  describe('when getting index list for time range', function() {

    describe('no interval', function() {
      it('should return correct index', function() {
        var pattern = new IndexPattern('my-metrics');
        var from = new Date(2015, 4, 30, 1, 2, 3);
        var to = new Date(2015, 5, 1, 12, 5 , 6);
        expect(pattern.getIndexList(from, to)).to.eql('my-metrics');
      });
    });

    describe('daily', function() {

      it('should return correct index list', function() {
        var pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'Daily');
        var from = new Date(1432940523000);
        var to = new Date(1433153106000);

        var expected =  [
        'asd-2015.05.29',
        'asd-2015.05.30',
        'asd-2015.05.31',
        'asd-2015.06.01',
        ];

        expect(pattern.getIndexList(from, to)).to.eql(expected);
      });

    });
  });

});

define([
  'moment',
  'plugins/datasource/elasticsearch/indexPattern'
], function(moment, IndexPattern) {
  'use strict';

  describe('IndexPattern', function() {

    describe('when getting index for today', function() {
      it('should return correct index name', function() {
        var pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'daily');
        var expected = 'asd-' + moment().format('YYYY.MM.DD');

        expect(pattern.getIndexForToday()).to.be(expected);
      });
    });

    describe('when getting index list for time range', function() {

      describe('daily', function() {

        it('should return correct index list', function() {
          var pattern = new IndexPattern('[asd-]YYYY.MM.DD', 'daily');
          var from = new Date(2015, 4, 29);
          var to = new Date(2015, 5, 1);

          expect(pattern.getIndexList(from, to)).to.be(['asd', 'asd2']);
        });
      })

    });

  });

});

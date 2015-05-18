define([
  'plugins/datasource/influxdb/influxSeries'
], function(InfluxSeries) {
  'use strict';

  describe('when generating timeseries from influxdb response', function() {

    describe('given two series', function() {
      var options = { series: [
        {
          name: 'cpu',
          tags:  {app: 'test'},
          columns: ['time', 'mean'],
          values: [["2015-05-18T10:57:05Z", 10], ["2015-05-18T10:57:06Z", 12]]
        },
        {
          name: 'cpu',
          tags:  {app: 'test2'},
          columns: ['time', 'mean'],
          values: [["2015-05-18T10:57:05Z", 15], ["2015-05-18T10:57:06Z", 16]]
        }
      ]};

      describe('and no alias', function() {

        it('should generate two time series', function() {
          var series = new InfluxSeries(options);
          var result = series.getTimeSeries();

          expect(result.length).to.be(2);
          expect(result[0].target).to.be('cpu {app: test}');
          expect(result[0].datapoints[0][0]).to.be(10);
          expect(result[0].datapoints[0][1]).to.be(1431946625000);
          expect(result[0].datapoints[1][0]).to.be(12);
          expect(result[0].datapoints[1][1]).to.be(1431946626000);

          expect(result[1].target).to.be('cpu {app: test2}');
          expect(result[1].datapoints[0][0]).to.be(15);
          expect(result[1].datapoints[0][1]).to.be(1431946625000);
          expect(result[1].datapoints[1][0]).to.be(16);
          expect(result[1].datapoints[1][1]).to.be(1431946626000);
        });
      });

      describe('and simple alias', function() {
        it('should use alias', function() {
          options.alias = 'new series';
          var series = new InfluxSeries(options);
          var result = series.getTimeSeries();

          expect(result[0].target).to.be('new series');
        });

      });
    });

  });

});

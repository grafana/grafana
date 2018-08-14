import InfluxSeries from '../influx_series';

describe('when generating timeseries from influxdb response', function() {
  describe('given multiple fields for series', function() {
    var options = {
      alias: '',
      series: [
        {
          name: 'cpu',
          tags: { app: 'test', server: 'server1' },
          columns: ['time', 'mean', 'max', 'min'],
          values: [[1431946625000, 10, 11, 9], [1431946626000, 20, 21, 19]],
        },
      ],
    };
    describe('and no alias', function() {
      it('should generate multiple datapoints for each column', function() {
        var series = new InfluxSeries(options);
        var result = series.getTimeSeries();

        expect(result.length).toBe(3);
        expect(result[0].target).toBe('cpu.mean {app: test, server: server1}');
        expect(result[0].datapoints[0][0]).toBe(10);
        expect(result[0].datapoints[0][1]).toBe(1431946625000);
        expect(result[0].datapoints[1][0]).toBe(20);
        expect(result[0].datapoints[1][1]).toBe(1431946626000);

        expect(result[1].target).toBe('cpu.max {app: test, server: server1}');
        expect(result[1].datapoints[0][0]).toBe(11);
        expect(result[1].datapoints[0][1]).toBe(1431946625000);
        expect(result[1].datapoints[1][0]).toBe(21);
        expect(result[1].datapoints[1][1]).toBe(1431946626000);

        expect(result[2].target).toBe('cpu.min {app: test, server: server1}');
        expect(result[2].datapoints[0][0]).toBe(9);
        expect(result[2].datapoints[0][1]).toBe(1431946625000);
        expect(result[2].datapoints[1][0]).toBe(19);
        expect(result[2].datapoints[1][1]).toBe(1431946626000);
      });
    });

    describe('and simple alias', function() {
      it('should use alias', function() {
        options.alias = 'new series';
        var series = new InfluxSeries(options);
        var result = series.getTimeSeries();

        expect(result[0].target).toBe('new series');
        expect(result[1].target).toBe('new series');
        expect(result[2].target).toBe('new series');
      });
    });

    describe('and alias patterns', function() {
      it('should replace patterns', function() {
        options.alias = 'alias: $m -> $tag_server ([[measurement]])';
        var series = new InfluxSeries(options);
        var result = series.getTimeSeries();

        expect(result[0].target).toBe('alias: cpu -> server1 (cpu)');
        expect(result[1].target).toBe('alias: cpu -> server1 (cpu)');
        expect(result[2].target).toBe('alias: cpu -> server1 (cpu)');
      });
    });
  });

  describe('given measurement with default fieldname', function() {
    var options = {
      series: [
        {
          name: 'cpu',
          tags: { app: 'test', server: 'server1' },
          columns: ['time', 'value'],
          values: [['2015-05-18T10:57:05Z', 10], ['2015-05-18T10:57:06Z', 12]],
        },
        {
          name: 'cpu',
          tags: { app: 'test2', server: 'server2' },
          columns: ['time', 'value'],
          values: [['2015-05-18T10:57:05Z', 15], ['2015-05-18T10:57:06Z', 16]],
        },
      ],
    };

    describe('and no alias', function() {
      it('should generate label with no field', function() {
        var series = new InfluxSeries(options);
        var result = series.getTimeSeries();

        expect(result[0].target).toBe('cpu {app: test, server: server1}');
        expect(result[1].target).toBe('cpu {app: test2, server: server2}');
      });
    });
  });

  describe('given two series', function() {
    var options = {
      alias: '',
      series: [
        {
          name: 'cpu',
          tags: { app: 'test', server: 'server1' },
          columns: ['time', 'mean'],
          values: [[1431946625000, 10], [1431946626000, 12]],
        },
        {
          name: 'cpu',
          tags: { app: 'test2', server: 'server2' },
          columns: ['time', 'mean'],
          values: [[1431946625000, 15], [1431946626000, 16]],
        },
      ],
    };

    describe('and no alias', function() {
      it('should generate two time series', function() {
        var series = new InfluxSeries(options);
        var result = series.getTimeSeries();

        expect(result.length).toBe(2);
        expect(result[0].target).toBe('cpu.mean {app: test, server: server1}');
        expect(result[0].datapoints[0][0]).toBe(10);
        expect(result[0].datapoints[0][1]).toBe(1431946625000);
        expect(result[0].datapoints[1][0]).toBe(12);
        expect(result[0].datapoints[1][1]).toBe(1431946626000);

        expect(result[1].target).toBe('cpu.mean {app: test2, server: server2}');
        expect(result[1].datapoints[0][0]).toBe(15);
        expect(result[1].datapoints[0][1]).toBe(1431946625000);
        expect(result[1].datapoints[1][0]).toBe(16);
        expect(result[1].datapoints[1][1]).toBe(1431946626000);
      });
    });

    describe('and simple alias', function() {
      it('should use alias', function() {
        options.alias = 'new series';
        var series = new InfluxSeries(options);
        var result = series.getTimeSeries();

        expect(result[0].target).toBe('new series');
      });
    });

    describe('and alias patterns', function() {
      it('should replace patterns', function() {
        options.alias = 'alias: $m -> $tag_server ([[measurement]])';
        var series = new InfluxSeries(options);
        var result = series.getTimeSeries();

        expect(result[0].target).toBe('alias: cpu -> server1 (cpu)');
        expect(result[1].target).toBe('alias: cpu -> server2 (cpu)');
      });
    });
  });

  describe('given measurement with dots', function() {
    var options = {
      alias: '',
      series: [
        {
          name: 'app.prod.server1.count',
          tags: {},
          columns: ['time', 'mean'],
          values: [[1431946625000, 10], [1431946626000, 12]],
        },
      ],
    };

    it('should replace patterns', function() {
      options.alias = 'alias: $1 -> [[3]]';
      var series = new InfluxSeries(options);
      var result = series.getTimeSeries();

      expect(result[0].target).toBe('alias: prod -> count');
    });
  });

  describe('given table response', function() {
    var options = {
      alias: '',
      series: [
        {
          name: 'app.prod.server1.count',
          tags: { datacenter: 'Africa', server: 'server2' },
          columns: ['time', 'value2', 'value'],
          values: [[1431946625000, 23, 10], [1431946626000, 25, 12]],
        },
      ],
    };

    it('should return table', function() {
      var series = new InfluxSeries(options);
      var table = series.getTable();

      expect(table.type).toBe('table');
      expect(table.columns.length).toBe(5);
      expect(table.columns[0].text).toEqual('Time');
      expect(table.rows[0]).toEqual([1431946625000, 'Africa', 'server2', 23, 10]);
    });
  });

  describe('given table response from SHOW CARDINALITY', function() {
    var options = {
      alias: '',
      series: [
        {
          name: 'cpu',
          columns: ['count'],
          values: [[37]],
        },
      ],
    };

    it('should return table', function() {
      var series = new InfluxSeries(options);
      var table = series.getTable();

      expect(table.type).toBe('table');
      expect(table.columns.length).toBe(1);
      expect(table.columns[0].text).toEqual('count');
      expect(table.rows[0]).toEqual([37]);
    });
  });

  describe('given annotation response', function() {
    describe('with empty tagsColumn', function() {
      var options = {
        alias: '',
        annotation: {},
        series: [
          {
            name: 'logins.count',
            tags: { datacenter: 'Africa', server: 'server2' },
            columns: ['time', 'datacenter', 'hostname', 'source', 'value'],
            values: [[1481549440372, 'America', '10.1.100.10', 'backend', 215.7432653659507]],
          },
        ],
      };

      it('should multiple tags', function() {
        var series = new InfluxSeries(options);
        var annotations = series.getAnnotations();

        expect(annotations[0].tags.length).toBe(0);
      });
    });

    describe('given annotation response', function() {
      var options = {
        alias: '',
        annotation: {
          tagsColumn: 'datacenter, source',
        },
        series: [
          {
            name: 'logins.count',
            tags: { datacenter: 'Africa', server: 'server2' },
            columns: ['time', 'datacenter', 'hostname', 'source', 'value'],
            values: [[1481549440372, 'America', '10.1.100.10', 'backend', 215.7432653659507]],
          },
        ],
      };

      it('should multiple tags', function() {
        var series = new InfluxSeries(options);
        var annotations = series.getAnnotations();

        expect(annotations[0].tags.length).toBe(2);
        expect(annotations[0].tags[0]).toBe('America');
        expect(annotations[0].tags[1]).toBe('backend');
      });
    });
  });
});

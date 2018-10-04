import InfluxSeries from '../influx_series';

describe('when generating timeseries from influxdb response', () => {
  describe('given multiple fields for series', () => {
    const options = {
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
    describe('and no alias', () => {
      it('should generate multiple datapoints for each column', () => {
        const series = new InfluxSeries(options);
        const result = series.getTimeSeries();

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

    describe('and simple alias', () => {
      it('should use alias', () => {
        options.alias = 'new series';
        const series = new InfluxSeries(options);
        const result = series.getTimeSeries();

        expect(result[0].target).toBe('new series');
        expect(result[1].target).toBe('new series');
        expect(result[2].target).toBe('new series');
      });
    });

    describe('and alias patterns', () => {
      it('should replace patterns', () => {
        options.alias = 'alias: $m -> $tag_server ([[measurement]])';
        const series = new InfluxSeries(options);
        const result = series.getTimeSeries();

        expect(result[0].target).toBe('alias: cpu -> server1 (cpu)');
        expect(result[1].target).toBe('alias: cpu -> server1 (cpu)');
        expect(result[2].target).toBe('alias: cpu -> server1 (cpu)');
      });
    });
  });

  describe('given measurement with default fieldname', () => {
    const options = {
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

    describe('and no alias', () => {
      it('should generate label with no field', () => {
        const series = new InfluxSeries(options);
        const result = series.getTimeSeries();

        expect(result[0].target).toBe('cpu {app: test, server: server1}');
        expect(result[1].target).toBe('cpu {app: test2, server: server2}');
      });
    });
  });

  describe('given two series', () => {
    const options = {
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

    describe('and no alias', () => {
      it('should generate two time series', () => {
        const series = new InfluxSeries(options);
        const result = series.getTimeSeries();

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

    describe('and simple alias', () => {
      it('should use alias', () => {
        options.alias = 'new series';
        const series = new InfluxSeries(options);
        const result = series.getTimeSeries();

        expect(result[0].target).toBe('new series');
      });
    });

    describe('and alias patterns', () => {
      it('should replace patterns', () => {
        options.alias = 'alias: $m -> $tag_server ([[measurement]])';
        const series = new InfluxSeries(options);
        const result = series.getTimeSeries();

        expect(result[0].target).toBe('alias: cpu -> server1 (cpu)');
        expect(result[1].target).toBe('alias: cpu -> server2 (cpu)');
      });
    });
  });

  describe('given measurement with dots', () => {
    const options = {
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

    it('should replace patterns', () => {
      options.alias = 'alias: $1 -> [[3]]';
      const series = new InfluxSeries(options);
      const result = series.getTimeSeries();

      expect(result[0].target).toBe('alias: prod -> count');
    });
  });

  describe('given table response', () => {
    const options = {
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

    it('should return table', () => {
      const series = new InfluxSeries(options);
      const table = series.getTable();

      expect(table.type).toBe('table');
      expect(table.columns.length).toBe(5);
      expect(table.columns[0].text).toEqual('Time');
      expect(table.rows[0]).toEqual([1431946625000, 'Africa', 'server2', 23, 10]);
    });
  });

  describe('given table response from SHOW CARDINALITY', () => {
    const options = {
      alias: '',
      series: [
        {
          name: 'cpu',
          columns: ['count'],
          values: [[37]],
        },
      ],
    };

    it('should return table', () => {
      const series = new InfluxSeries(options);
      const table = series.getTable();

      expect(table.type).toBe('table');
      expect(table.columns.length).toBe(1);
      expect(table.columns[0].text).toEqual('count');
      expect(table.rows[0]).toEqual([37]);
    });
  });

  describe('given annotation response', () => {
    describe('with empty tagsColumn', () => {
      const options = {
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

      it('should multiple tags', () => {
        const series = new InfluxSeries(options);
        const annotations = series.getAnnotations();

        expect(annotations[0].tags.length).toBe(0);
      });
    });

    describe('given annotation response', () => {
      const options = {
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

      it('should multiple tags', () => {
        const series = new InfluxSeries(options);
        const annotations = series.getAnnotations();

        expect(annotations[0].tags.length).toBe(2);
        expect(annotations[0].tags[0]).toBe('America');
        expect(annotations[0].tags[1]).toBe('backend');
      });
    });
  });
});

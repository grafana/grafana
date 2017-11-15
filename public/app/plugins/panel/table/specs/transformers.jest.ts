import {transformers, transformDataToTable} from '../transformers';

describe('when transforming time series table', () => {
  var table;

  describe('given 2 time series', () => {
    var time = new Date().getTime();
    var timeSeries = [
      {
        target: 'series1',
        datapoints: [[12.12, time], [14.44, time+1]],
      },
      {
        target: 'series2',
        datapoints: [[16.12, time]],
      }
    ];

    describe('timeseries_to_rows', () => {
      var panel = {
        transform: 'timeseries_to_rows',
        sort: {col: 0, desc: true},
      };

      beforeEach(() => {
        table = transformDataToTable(timeSeries, panel);
      });

      it('should return 3 rows', () => {
        expect(table.rows.length).toBe(3);
        expect(table.rows[0][1]).toBe('series1');
        expect(table.rows[1][1]).toBe('series1');
        expect(table.rows[2][1]).toBe('series2');
        expect(table.rows[0][2]).toBe(12.12);
      });

      it('should return 3 rows', () => {
        expect(table.columns.length).toBe(3);
        expect(table.columns[0].text).toBe('Time');
        expect(table.columns[1].text).toBe('Metric');
        expect(table.columns[2].text).toBe('Value');
      });
    });

    describe('timeseries_to_columns', () => {
      var panel = {
        transform: 'timeseries_to_columns'
      };

      beforeEach(() => {
        table = transformDataToTable(timeSeries, panel);
      });

      it ('should return 3 columns', () => {
        expect(table.columns.length).toBe(3);
        expect(table.columns[0].text).toBe('Time');
        expect(table.columns[1].text).toBe('series1');
        expect(table.columns[2].text).toBe('series2');
      });

      it ('should return 2 rows', () => {
        expect(table.rows.length).toBe(2);
        expect(table.rows[0][1]).toBe(12.12);
        expect(table.rows[0][2]).toBe(16.12);
      });

      it ('should be undefined when no value for timestamp', () => {
        expect(table.rows[1][2]).toBe(undefined);
      });
    });

    describe('timeseries_aggregations', () => {
      var panel = {
        transform: 'timeseries_aggregations',
        sort: {col: 0, desc: true},
        columns: [{text: 'Max', value: 'max'}, {text: 'Min', value: 'min'}]
      };

      beforeEach(() => {
        table = transformDataToTable(timeSeries, panel);
      });

      it('should return 2 rows', () => {
        expect(table.rows.length).toBe(2);
        expect(table.rows[0][0]).toBe('series1');
        expect(table.rows[0][1]).toBe(14.44);
        expect(table.rows[0][2]).toBe(12.12);
      });

      it('should return 2 columns', () => {
        expect(table.columns.length).toBe(3);
        expect(table.columns[0].text).toBe('Metric');
        expect(table.columns[1].text).toBe('Max');
        expect(table.columns[2].text).toBe('Min');
      });
    });

    describe('JSON Data', () => {
      var panel = {
        transform: 'json',
        columns: [
          {text: 'Timestamp', value: 'timestamp'},
          {text: 'Message', value: 'message'},
          {text: 'nested.level2', value: 'nested.level2'},
        ]
      };
      var rawData = [
        {
          type: 'docs',
          datapoints: [
            {
              timestamp: 'time',
              message: 'message',
              nested: {
                level2: 'level2-value'
              }
            }
          ]
        }
      ];

      describe('getColumns', function() {
        it('should return nested properties', function() {
          var columns = transformers['json'].getColumns(rawData);
          expect(columns[0].text).toBe('timestamp');
          expect(columns[1].text).toBe('message');
          expect(columns[2].text).toBe('nested.level2');
        });
      });

      describe('transform', function() {
        beforeEach(() => {
          table = transformDataToTable(rawData, panel);
        });

        it ('should return 2 columns', () => {
          expect(table.columns.length).toBe(3);
          expect(table.columns[0].text).toBe('Timestamp');
          expect(table.columns[1].text).toBe('Message');
          expect(table.columns[2].text).toBe('nested.level2');
        });

        it ('should return 2 rows', () => {
          expect(table.rows.length).toBe(1);
          expect(table.rows[0][0]).toBe('time');
          expect(table.rows[0][1]).toBe('message');
          expect(table.rows[0][2]).toBe('level2-value');
        });
      });
    });

    describe('Annnotations', () => {
      var panel = {transform: 'annotations'};
      var rawData = {
        annotations: [
          {
            time: 1000,
            text: 'hej',
            tags: ['tags', 'asd'],
            title: 'title',
          }
        ]
      };

      beforeEach(() => {
        table = transformDataToTable(rawData, panel);
      });

      it ('should return 4 columns', () => {
        expect(table.columns.length).toBe(4);
        expect(table.columns[0].text).toBe('Time');
        expect(table.columns[1].text).toBe('Title');
        expect(table.columns[2].text).toBe('Text');
        expect(table.columns[3].text).toBe('Tags');
      });

      it ('should return 1 rows', () => {
        expect(table.rows.length).toBe(1);
        expect(table.rows[0][0]).toBe(1000);
      });
    });

  });
});


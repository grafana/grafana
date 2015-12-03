import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {TableModel} from '../table_model';
import {transformers} from '../transformers';

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
        table = TableModel.transform(timeSeries, panel);
      });

      it('should return 3 rows', () => {
        expect(table.rows.length).to.be(3);
        expect(table.rows[0][1]).to.be('series1');
        expect(table.rows[1][1]).to.be('series1');
        expect(table.rows[2][1]).to.be('series2');
        expect(table.rows[0][2]).to.be(12.12);
      });

      it('should return 3 rows', () => {
        expect(table.columns.length).to.be(3);
        expect(table.columns[0].text).to.be('Time');
        expect(table.columns[1].text).to.be('Metric');
        expect(table.columns[2].text).to.be('Value');
      });
    });

    describe('timeseries_to_columns', () => {
      var panel = {
        transform: 'timeseries_to_columns'
      };

      beforeEach(() => {
        table = TableModel.transform(timeSeries, panel);
      });

      it ('should return 3 columns', () => {
        expect(table.columns.length).to.be(3);
        expect(table.columns[0].text).to.be('Time');
        expect(table.columns[1].text).to.be('series1');
        expect(table.columns[2].text).to.be('series2');
      });

      it ('should return 2 rows', () => {
        expect(table.rows.length).to.be(2);
        expect(table.rows[0][1]).to.be(12.12);
        expect(table.rows[0][2]).to.be(16.12);
      });

      it ('should be undefined when no value for timestamp', () => {
        expect(table.rows[1][2]).to.be(undefined);
      });
    });

    describe('timeseries_aggregations', () => {
      var panel = {
        transform: 'timeseries_aggregations',
        sort: {col: 0, desc: true},
        columns: [{text: 'Max', value: 'max'}, {text: 'Min', value: 'min'}]
      };

      beforeEach(() => {
        table = TableModel.transform(timeSeries, panel);
      });

      it('should return 2 rows', () => {
        expect(table.rows.length).to.be(2);
        expect(table.rows[0][0]).to.be('series1');
        expect(table.rows[0][1]).to.be(14.44);
        expect(table.rows[0][2]).to.be(12.12);
      });

      it('should return 2 columns', () => {
        expect(table.columns.length).to.be(3);
        expect(table.columns[0].text).to.be('Metric');
        expect(table.columns[1].text).to.be('Max');
        expect(table.columns[2].text).to.be('Min');
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
          expect(columns[0].text).to.be('timestamp');
          expect(columns[1].text).to.be('message');
          expect(columns[2].text).to.be('nested.level2');
        });
      });

      describe('transform', function() {
        beforeEach(() => {
          table = TableModel.transform(rawData, panel);
        });

        it ('should return 2 columns', () => {
          expect(table.columns.length).to.be(3);
          expect(table.columns[0].text).to.be('Timestamp');
          expect(table.columns[1].text).to.be('Message');
          expect(table.columns[2].text).to.be('nested.level2');
        });

        it ('should return 2 rows', () => {
          expect(table.rows.length).to.be(1);
          expect(table.rows[0][0]).to.be('time');
          expect(table.rows[0][1]).to.be('message');
          expect(table.rows[0][2]).to.be('level2-value');
        });
      });
    });

    describe('Annnotations', () => {
      var panel = {transform: 'annotations'};
      var rawData = [
        {
          min: 1000,
          text: 'hej',
          tags: ['tags', 'asd'],
          title: 'title',
        }
      ];

      beforeEach(() => {
        table = TableModel.transform(rawData, panel);
      });

      it ('should return 4 columns', () => {
        expect(table.columns.length).to.be(4);
        expect(table.columns[0].text).to.be('Time');
        expect(table.columns[1].text).to.be('Title');
        expect(table.columns[2].text).to.be('Text');
        expect(table.columns[3].text).to.be('Tags');
      });

      it ('should return 1 rows', () => {
        expect(table.rows.length).to.be(1);
        expect(table.rows[0][0]).to.be(1000);
      });
    });

  });
});


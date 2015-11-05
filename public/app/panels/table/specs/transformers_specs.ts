import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {TableModel} from '../table_model';

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
      var panel = {transform: 'timeseries_to_rows'};

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
        expect(table.columns[1].text).to.be('Series');
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
  });
});


import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {TableModel} from '../table_model';

describe('when getting tableData', () => {

  describe('timeseries_to_rows', () => {
    var panel = {
      transform: 'timeseries_to_rows'
    };

    it ('should return 2 rows', () => {
      var data = TableModel.transform([
        {
          target: 'series1',
          datapoints: [[12.12, new Date().getTime()]],
        },
        {
          target: 'series2',
          datapoints: [[12.12, new Date().getTime()]],
        }
      ], panel);

      expect(data.columns.length).to.be(3);
      expect(data.rows.length).to.be(2);

      expect(data.columns[0].text).to.be('Time');
      expect(data.columns[1].text).to.be('Series');
      expect(data.columns[2].text).to.be('Value');
      expect(data.rows[0][1]).to.be('series1');
      expect(data.rows[0][2]).to.be('12.12');

      expect(data.rows[1][1]).to.be('series2');
    });
  });

  describe('timeseries_to_rows', () => {
    var panel = {
      transform: 'timeseries_to_columns'
    };

    it ('should return 3 columns', () => {
      var data = TableModel.transform([
        {
          target: 'series1',
          datapoints: [[12.12, new Date().getTime()]],
        },
        {
          target: 'series2',
          datapoints: [[16.12, new Date().getTime()]],
        }
      ], panel);

      expect(data.columns.length).to.be(3);
      expect(data.rows.length).to.be(1);

      expect(data.columns[0].text).to.be('Time');
      expect(data.columns[1].text).to.be('series1');
      expect(data.columns[2].text).to.be('series2');
      expect(data.rows[0][1]).to.be('12.12');
      expect(data.rows[0][2]).to.be('16.12');
    });
  });

});

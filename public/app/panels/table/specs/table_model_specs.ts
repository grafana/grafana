import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {TableModel} from '../table_model';

describe('when getting tableData', () => {

  describe('simple time series', () => {
    var panel = {
    };

    it ('should return 2 columns', () => {
      var data = TableModel.transform([
        {
          target: 'test',
          datapoints: [[12.12, new Date().getTime()]],
        }
      ], panel);

      expect(data.columns.length).to.be(2);
      expect(data.rows.length).to.be(1);

      expect(data.columns[0].text).to.be('Time');
      expect(data.columns[1].text).to.be('Value');
    });

  });

});

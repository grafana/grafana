import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {TableModel} from '../table_model';
import {TableRenderer} from '../renderer';

describe('when rendering table', () => {
  describe('given 2 columns', () => {
    var table = new TableModel();
    table.columns = [{text: 'Time'}, {text: 'Value'}];

    var panel = {
      pageSize: 10,
      columns: [
        {
          pattern: 'Time',
          type: 'date',
          format: 'LLL'
        }
      ]
    };

    var renderer = new TableRenderer(panel, table, 'utc');

    it('time column should be formated', () => {
      var html = renderer.renderCell(0, 1388556366666);
      expect(html).to.be('<td>2014-01-01T06:06:06+00:00</td>');
    });

  });
});



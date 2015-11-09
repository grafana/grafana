import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {TableModel} from '../table_model';
import {TableRenderer} from '../renderer';

describe('when rendering table', () => {
  describe('given 2 columns', () => {
    var table = new TableModel();
    table.columns = [
      {text: 'Time'},
      {text: 'Value'},
      {text: 'Colored'}
    ];

    var panel = {
      pageSize: 10,
      columns: [
        {
          pattern: 'Time',
          type: 'date',
          format: 'LLL'
        },
        {
          pattern: 'Value',
          type: 'number',
          unit: 'ms',
          decimals: 3,
        },
        {
          pattern: 'Colored',
          type: 'number',
          unit: 'none',
          decimals: 1,
          colorMode: 'value',
          thresholds: [0, 50, 80],
          colors: ['green', 'orange', 'red']
        }
      ]
    };

    var renderer = new TableRenderer(panel, table, 'utc');

    it('time column should be formated', () => {
      var html = renderer.renderCell(0, 1388556366666);
      expect(html).to.be('<td>2014-01-01T06:06:06+00:00</td>');
    });

    it('number column should be formated', () => {
      var html = renderer.renderCell(1, 1230);
      expect(html).to.be('<td>1.230 s</td>');
    });

    it('number style should ignore string values', () => {
      var html = renderer.renderCell(1, 'asd');
      expect(html).to.be('<td>asd</td>');
    });

    it('colored cell should have style', () => {
      var html = renderer.renderCell(2, 55);
      expect(html).to.be('<td style="color:orange">55.0</td>');
    });
  });
});



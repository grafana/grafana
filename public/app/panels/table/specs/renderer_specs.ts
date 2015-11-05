import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {TableModel} from '../table_model';
import {TableRenderer} from '../renderer';

describe('when rendering table', () => {
  describe('given 2 columns', () => {
    var table = new TableModel();
    table.columns = [{text: 'Time'}, {text: 'Value'}];
    table.rows.push([1446733230253, 12.4]);
    table.rows.push([1446733231253, 10.4]);

    var panel = {
      pageSize: 10
    };

    it('render should return html', () => {
      var html = new TableRenderer(panel, table).render(0);
      expect(html).to.be('<tr><td>value</td></tr>');
    });

  });
});



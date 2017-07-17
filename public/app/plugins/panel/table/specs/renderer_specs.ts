import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import _ from 'lodash';
import TableModel from 'app/core/table_model';
import {TableRenderer} from '../renderer';

describe('when rendering table', () => {
  describe('given 2 columns', () => {
    var table = new TableModel();
    table.columns = [
      {text: 'Time'},
      {text: 'Value'},
      {text: 'Colored'},
      {text: 'Undefined'},
      {text: 'String'},
      {text: 'United', unit: 'bps'},
      {text: 'Sanitized'},
      {text: 'Link'},
    ];
    table.rows = [
      [1388556366666, 1230, 40, undefined, "", "", "my.host.com", "host1"]
    ];

    var panel = {
      pageSize: 10,
      styles: [
        {
          pattern: 'Time',
          type: 'date',
          format: 'LLL',
          alias: 'Timestamp'
        },
        {
          pattern: '/(Val)ue/',
          type: 'number',
          unit: 'ms',
          decimals: 3,
          alias: '$1'
        },
        {
          pattern: 'Colored',
          type: 'number',
          unit: 'none',
          decimals: 1,
          colorMode: 'value',
          thresholds: [50, 80],
          colors: ['green', 'orange', 'red']
        },
        {
          pattern: 'String',
          type: 'string',
        },
        {
          pattern: 'United',
          type: 'number',
          unit: 'ms',
          decimals: 2,
        },
        {
          pattern: 'Sanitized',
          type: 'string',
          sanitize: true,
        },
        {
          pattern: 'Link',
          type: 'string',
          link: true,
          linkUrl: "/dashboard?param=$__cell&param_1=$__cell_1&param_2=$__cell_2",
          linkTooltip: "$__cell $__cell_1 $__cell_6",
          linkTargetBlank: true
        }
      ]
    };

    var sanitize = function(value) {
      return 'sanitized';
    };

    var templateSrv = {
      replace: function(value, scopedVars) {
        if (scopedVars) {
          // For testing variables replacement in link
          _.each(scopedVars, function(val, key) {
            value = value.replace('$' + key, val.value);
          });
        }
        return value;
      }
    };

    var renderer = new TableRenderer(panel, table, 'utc', sanitize, templateSrv);

    it('time column should be formated', () => {
      var html = renderer.renderCell(0, 0, 1388556366666);
      expect(html).to.be('<td>2014-01-01T06:06:06Z</td>');
    });

    it('undefined time column should be rendered as -', () => {
      var html = renderer.renderCell(0, 0, undefined);
      expect(html).to.be('<td>-</td>');
    });

    it('null time column should be rendered as -', () => {
      var html = renderer.renderCell(0, 0, null);
      expect(html).to.be('<td>-</td>');
    });

    it('number column with unit specified should ignore style unit', () => {
      var html = renderer.renderCell(5, 0, 1230);
      expect(html).to.be('<td>1.23 kbps</td>');
    });

    it('number column should be formated', () => {
      var html = renderer.renderCell(1, 0, 1230);
      expect(html).to.be('<td>1.230 s</td>');
    });

    it('number style should ignore string values', () => {
      var html = renderer.renderCell(1, 0, 'asd');
      expect(html).to.be('<td>asd</td>');
    });

    it('colored cell should have style', () => {
      var html = renderer.renderCell(2, 0, 40);
      expect(html).to.be('<td style="color:green">40.0</td>');
    });

    it('colored cell should have style', () => {
      var html = renderer.renderCell(2, 0, 55);
      expect(html).to.be('<td style="color:orange">55.0</td>');
    });

    it('colored cell should have style', () => {
      var html = renderer.renderCell(2, 0, 85);
      expect(html).to.be('<td style="color:red">85.0</td>');
    });

    it('unformated undefined should be rendered as string', () => {
      var html = renderer.renderCell(3, 0, 'value');
      expect(html).to.be('<td>value</td>');
    });

    it('string style with escape html should return escaped html', () => {
      var html = renderer.renderCell(4, 0, "&breaking <br /> the <br /> row");
      expect(html).to.be('<td>&amp;breaking &lt;br /&gt; the &lt;br /&gt; row</td>');
    });

    it('undefined formater should return escaped html', () => {
      var html = renderer.renderCell(3, 0, "&breaking <br /> the <br /> row");
      expect(html).to.be('<td>&amp;breaking &lt;br /&gt; the &lt;br /&gt; row</td>');
    });

    it('undefined value should render as -', () => {
      var html = renderer.renderCell(3, 0, undefined);
      expect(html).to.be('<td></td>');
    });

    it('sanitized value should render as', () => {
      var html = renderer.renderCell(6, 0, 'text <a href="http://google.com">link</a>');
      expect(html).to.be('<td>sanitized</td>');
    });

    it('Time column title should be Timestamp', () => {
      expect(table.columns[0].title).to.be('Timestamp');
    });

    it('Value column title should be Val', () => {
      expect(table.columns[1].title).to.be('Val');
    });

    it('Colored column title should be Colored', () => {
      expect(table.columns[2].title).to.be('Colored');
    });

    it('link should render as', () => {
      var html = renderer.renderCell(7, 0, 'host1');
      var expectedHtml = `
        <td class="table-panel-cell-link">
          <a href="/dashboard?param=host1&param_1=1230&param_2=40"
            target="_blank" data-link-tooltip data-original-title="host1 1230 my.host.com" data-placement="right">
            host1
          </a>
        </td>
      `;
      expect(normalize(html)).to.be(normalize(expectedHtml));
    });
  });
});

function normalize(str) {
  return str.replace(/\s+/gm, ' ').trim();
}

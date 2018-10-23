import _ from 'lodash';
import TableModel from 'app/core/table_model';
import { TableRenderer } from '../renderer';

describe('when rendering table', () => {
  describe('given 13 columns', () => {
    const table = new TableModel();
    table.columns = [
      { text: 'Time' },
      { text: 'Value' },
      { text: 'Colored' },
      { text: 'Undefined' },
      { text: 'String' },
      { text: 'United', unit: 'bps' },
      { text: 'Sanitized' },
      { text: 'Link' },
      { text: 'Array' },
      { text: 'Mapping' },
      { text: 'RangeMapping' },
      { text: 'MappingColored' },
      { text: 'RangeMappingColored' },
    ];
    table.rows = [
      [1388556366666, 1230, 40, undefined, '', '', 'my.host.com', 'host1', ['value1', 'value2'], 1, 2, 1, 2],
    ];

    const panel = {
      pageSize: 10,
      styles: [
        {
          pattern: 'Time',
          type: 'date',
          format: 'LLL',
          alias: 'Timestamp',
        },
        {
          pattern: '/(Val)ue/',
          type: 'number',
          unit: 'ms',
          decimals: 3,
          alias: '$1',
        },
        {
          pattern: 'Colored',
          type: 'number',
          unit: 'none',
          decimals: 1,
          colorMode: 'value',
          thresholds: [50, 80],
          colors: ['green', 'orange', 'red'],
        },
        {
          pattern: 'String',
          type: 'string',
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
          linkUrl: '/dashboard?param=$__cell&param_1=$__cell_1&param_2=$__cell_2',
          linkTooltip: '$__cell $__cell_1 $__cell_6',
          linkTargetBlank: true,
        },
        {
          pattern: 'Array',
          type: 'number',
          unit: 'ms',
          decimals: 3,
        },
        {
          pattern: 'Mapping',
          type: 'string',
          mappingType: 1,
          valueMaps: [
            {
              value: '1',
              text: 'on',
            },
            {
              value: '0',
              text: 'off',
            },
            {
              value: 'HELLO WORLD',
              text: 'HELLO GRAFANA',
            },
            {
              value: 'value1, value2',
              text: 'value3, value4',
            },
          ],
        },
        {
          pattern: 'RangeMapping',
          type: 'string',
          mappingType: 2,
          rangeMaps: [
            {
              from: '1',
              to: '3',
              text: 'on',
            },
            {
              from: '3',
              to: '6',
              text: 'off',
            },
          ],
        },
        {
          pattern: 'MappingColored',
          type: 'string',
          mappingType: 1,
          valueMaps: [
            {
              value: '1',
              text: 'on',
            },
            {
              value: '0',
              text: 'off',
            },
          ],
          colorMode: 'value',
          thresholds: [1, 2],
          colors: ['green', 'orange', 'red'],
        },
        {
          pattern: 'RangeMappingColored',
          type: 'string',
          mappingType: 2,
          rangeMaps: [
            {
              from: '1',
              to: '3',
              text: 'on',
            },
            {
              from: '3',
              to: '6',
              text: 'off',
            },
          ],
          colorMode: 'value',
          thresholds: [2, 5],
          colors: ['green', 'orange', 'red'],
        },
      ],
    };

    const sanitize = value => {
      return 'sanitized';
    };

    const templateSrv = {
      replace: (value, scopedVars) => {
        if (scopedVars) {
          // For testing variables replacement in link
          _.each(scopedVars, (val, key) => {
            value = value.replace('$' + key, val.value);
          });
        }
        return value;
      },
    };

    const renderer = new TableRenderer(panel, table, 'utc', sanitize, templateSrv);

    it('time column should be formated', () => {
      const html = renderer.renderCell(0, 0, 1388556366666);
      expect(html).toBe('<td>2014-01-01T06:06:06Z</td>');
    });

    it('undefined time column should be rendered as -', () => {
      const html = renderer.renderCell(0, 0, undefined);
      expect(html).toBe('<td>-</td>');
    });

    it('null time column should be rendered as -', () => {
      const html = renderer.renderCell(0, 0, null);
      expect(html).toBe('<td>-</td>');
    });

    it('number column with unit specified should ignore style unit', () => {
      const html = renderer.renderCell(5, 0, 1230);
      expect(html).toBe('<td>1.23 kbps</td>');
    });

    it('number column should be formated', () => {
      const html = renderer.renderCell(1, 0, 1230);
      expect(html).toBe('<td>1.230 s</td>');
    });

    it('number style should ignore string values', () => {
      const html = renderer.renderCell(1, 0, 'asd');
      expect(html).toBe('<td>asd</td>');
    });

    it('colored cell should have style', () => {
      const html = renderer.renderCell(2, 0, 40);
      expect(html).toBe('<td style="color:green">40.0</td>');
    });

    it('colored cell should have style', () => {
      const html = renderer.renderCell(2, 0, 55);
      expect(html).toBe('<td style="color:orange">55.0</td>');
    });

    it('colored cell should have style', () => {
      const html = renderer.renderCell(2, 0, 85);
      expect(html).toBe('<td style="color:red">85.0</td>');
    });

    it('unformated undefined should be rendered as string', () => {
      const html = renderer.renderCell(3, 0, 'value');
      expect(html).toBe('<td>value</td>');
    });

    it('string style with escape html should return escaped html', () => {
      const html = renderer.renderCell(4, 0, '&breaking <br /> the <br /> row');
      expect(html).toBe('<td>&amp;breaking &lt;br /&gt; the &lt;br /&gt; row</td>');
    });

    it('undefined formater should return escaped html', () => {
      const html = renderer.renderCell(3, 0, '&breaking <br /> the <br /> row');
      expect(html).toBe('<td>&amp;breaking &lt;br /&gt; the &lt;br /&gt; row</td>');
    });

    it('undefined value should render as -', () => {
      const html = renderer.renderCell(3, 0, undefined);
      expect(html).toBe('<td></td>');
    });

    it('sanitized value should render as', () => {
      const html = renderer.renderCell(6, 0, 'text <a href="http://google.com">link</a>');
      expect(html).toBe('<td>sanitized</td>');
    });

    it('Time column title should be Timestamp', () => {
      expect(table.columns[0].title).toBe('Timestamp');
    });

    it('Value column title should be Val', () => {
      expect(table.columns[1].title).toBe('Val');
    });

    it('Colored column title should be Colored', () => {
      expect(table.columns[2].title).toBe('Colored');
    });

    it('link should render as', () => {
      const html = renderer.renderCell(7, 0, 'host1');
      const expectedHtml = `
        <td class="table-panel-cell-link">
          <a href="/dashboard?param=host1&param_1=1230&param_2=40"
            target="_blank" data-link-tooltip data-original-title="host1 1230 my.host.com" data-placement="right">
            host1
          </a>
        </td>
      `;
      expect(normalize(html)).toBe(normalize(expectedHtml));
    });

    it('Array column should not use number as formatter', () => {
      const html = renderer.renderCell(8, 0, ['value1', 'value2']);
      expect(html).toBe('<td>value1, value2</td>');
    });

    it('numeric value should be mapped to text', () => {
      const html = renderer.renderCell(9, 0, 1);
      expect(html).toBe('<td>on</td>');
    });

    it('string numeric value should be mapped to text', () => {
      const html = renderer.renderCell(9, 0, '0');
      expect(html).toBe('<td>off</td>');
    });

    it('string value should be mapped to text', () => {
      const html = renderer.renderCell(9, 0, 'HELLO WORLD');
      expect(html).toBe('<td>HELLO GRAFANA</td>');
    });

    it('array column value should be mapped to text', () => {
      const html = renderer.renderCell(9, 0, ['value1', 'value2']);
      expect(html).toBe('<td>value3, value4</td>');
    });

    it('value should be mapped to text (range)', () => {
      const html = renderer.renderCell(10, 0, 2);
      expect(html).toBe('<td>on</td>');
    });

    it('value should be mapped to text (range)', () => {
      const html = renderer.renderCell(10, 0, 5);
      expect(html).toBe('<td>off</td>');
    });

    it('array column value should not be mapped to text', () => {
      const html = renderer.renderCell(10, 0, ['value1', 'value2']);
      expect(html).toBe('<td>value1, value2</td>');
    });

    it('value should be mapped to text and colored cell should have style', () => {
      const html = renderer.renderCell(11, 0, 1);
      expect(html).toBe('<td style="color:orange">on</td>');
    });

    it('value should be mapped to text and colored cell should have style', () => {
      const html = renderer.renderCell(11, 0, '1');
      expect(html).toBe('<td style="color:orange">on</td>');
    });

    it('value should be mapped to text and colored cell should have style', () => {
      const html = renderer.renderCell(11, 0, 0);
      expect(html).toBe('<td style="color:green">off</td>');
    });

    it('value should be mapped to text and colored cell should have style', () => {
      const html = renderer.renderCell(11, 0, '0');
      expect(html).toBe('<td style="color:green">off</td>');
    });

    it('value should be mapped to text and colored cell should have style', () => {
      const html = renderer.renderCell(11, 0, '2.1');
      expect(html).toBe('<td style="color:red">2.1</td>');
    });

    it('value should be mapped to text (range) and colored cell should have style', () => {
      const html = renderer.renderCell(12, 0, 0);
      expect(html).toBe('<td style="color:green">0</td>');
    });

    it('value should be mapped to text (range) and colored cell should have style', () => {
      const html = renderer.renderCell(12, 0, 1);
      expect(html).toBe('<td style="color:green">on</td>');
    });

    it('value should be mapped to text (range) and colored cell should have style', () => {
      const html = renderer.renderCell(12, 0, 4);
      expect(html).toBe('<td style="color:orange">off</td>');
    });

    it('value should be mapped to text (range) and colored cell should have style', () => {
      const html = renderer.renderCell(12, 0, '7.1');
      expect(html).toBe('<td style="color:red">7.1</td>');
    });
  });
});

function normalize(str) {
  return str.replace(/\s+/gm, ' ').trim();
}

import { __makeTemplateObject } from "tslib";
import { each } from 'lodash';
import TableModel from 'app/core/table_model';
import { TableRenderer } from '../renderer';
import { getTheme } from '@grafana/ui';
var utc = 'utc';
var sanitize = function (value) {
    return 'sanitized';
};
var templateSrv = {
    replace: function (value, scopedVars) {
        if (scopedVars) {
            // For testing variables replacement in link
            each(scopedVars, function (val, key) {
                value = value.replace('$' + key, val.value);
            });
        }
        return value;
    },
};
describe('when rendering table', function () {
    describe('given 13 columns', function () {
        var table = new TableModel();
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
            { text: 'HiddenType' },
            { text: 'RightAligned' },
        ];
        table.rows = [
            [
                1388556366666,
                1230,
                40,
                undefined,
                '',
                '',
                'my.host.com',
                'host1',
                ['value1', 'value2'],
                1,
                2,
                1,
                2,
                'ignored',
                42,
            ],
        ];
        var panel = {
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
                    colors: ['#00ff00', 'semi-dark-orange', 'rgb(1,0,0)'],
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
                    colors: ['#00ff00', 'semi-dark-orange', 'rgb(1,0,0)'],
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
                    colors: ['#00ff00', 'semi-dark-orange', 'rgb(1,0,0)'],
                },
                {
                    pattern: 'HiddenType',
                    type: 'hidden',
                },
                {
                    pattern: 'RightAligned',
                    align: 'right',
                },
            ],
        };
        //@ts-ignore
        var renderer = new TableRenderer(panel, table, utc, sanitize, templateSrv, getTheme());
        it('time column should be formatted', function () {
            var html = renderer.renderCell(0, 0, 1388556366666);
            expect(html).toBe('<td>2014-01-01T06:06:06Z</td>');
        });
        it('time column with epoch as string should be formatted', function () {
            var html = renderer.renderCell(0, 0, '1388556366666');
            expect(html).toBe('<td>2014-01-01T06:06:06Z</td>');
        });
        it('time column with RFC2822 date as string should be formatted', function () {
            var html = renderer.renderCell(0, 0, 'Sat, 01 Dec 2018 01:00:00 GMT');
            expect(html).toBe('<td>2018-12-01T01:00:00Z</td>');
        });
        it('time column with ISO date as string should be formatted', function () {
            var html = renderer.renderCell(0, 0, '2018-12-01T01:00:00Z');
            expect(html).toBe('<td>2018-12-01T01:00:00Z</td>');
        });
        it('undefined time column should be rendered as -', function () {
            var html = renderer.renderCell(0, 0, undefined);
            expect(html).toBe('<td>-</td>');
        });
        it('null time column should be rendered as -', function () {
            var html = renderer.renderCell(0, 0, null);
            expect(html).toBe('<td>-</td>');
        });
        it('number column with unit specified should ignore style unit', function () {
            var html = renderer.renderCell(5, 0, 1230);
            expect(html).toBe('<td>1.23 kb/s</td>');
        });
        it('number column should be formated', function () {
            var html = renderer.renderCell(1, 0, 1230);
            expect(html).toBe('<td>1.230 s</td>');
        });
        it('number column should format numeric string values', function () {
            var html = renderer.renderCell(1, 0, '1230');
            expect(html).toBe('<td>1.230 s</td>');
        });
        it('number style should ignore string non-numeric values', function () {
            var html = renderer.renderCell(1, 0, 'asd');
            expect(html).toBe('<td>asd</td>');
        });
        it('colored cell should have style (handles HEX color values)', function () {
            var html = renderer.renderCell(2, 0, 40);
            expect(html).toBe('<td style="color:#00ff00">40.0</td>');
        });
        it('colored cell should have style (handles named color values', function () {
            var html = renderer.renderCell(2, 0, 55);
            expect(html).toBe("<td style=\"color:" + '#FF780A' + "\">55.0</td>");
        });
        it('colored cell should have style handles(rgb color values)', function () {
            var html = renderer.renderCell(2, 0, 85);
            expect(html).toBe('<td style="color:rgb(1,0,0)">85.0</td>');
        });
        it('unformated undefined should be rendered as string', function () {
            var html = renderer.renderCell(3, 0, 'value');
            expect(html).toBe('<td>value</td>');
        });
        it('string style with escape html should return escaped html', function () {
            var html = renderer.renderCell(4, 0, '&breaking <br /> the <br /> row');
            expect(html).toBe('<td>&amp;breaking &lt;br /&gt; the &lt;br /&gt; row</td>');
        });
        it('undefined formater should return escaped html', function () {
            var html = renderer.renderCell(3, 0, '&breaking <br /> the <br /> row');
            expect(html).toBe('<td>&amp;breaking &lt;br /&gt; the &lt;br /&gt; row</td>');
        });
        it('undefined value should render as -', function () {
            var html = renderer.renderCell(3, 0, undefined);
            expect(html).toBe('<td></td>');
        });
        it('sanitized value should render as', function () {
            var html = renderer.renderCell(6, 0, 'text <a href="http://google.com">link</a>');
            expect(html).toBe('<td>sanitized</td>');
        });
        it('Time column title should be Timestamp', function () {
            expect(table.columns[0].title).toBe('Timestamp');
        });
        it('Value column title should be Val', function () {
            expect(table.columns[1].title).toBe('Val');
        });
        it('Colored column title should be Colored', function () {
            expect(table.columns[2].title).toBe('Colored');
        });
        it('link should render as', function () {
            var html = renderer.renderCell(7, 0, 'host1');
            var expectedHtml = "\n        <td class=\"table-panel-cell-link\"><a href=\"/dashboard?param=host1&param_1=1230&param_2=40\"\n            target=\"_blank\" data-link-tooltip data-original-title=\"host1 1230 my.host.com\"\n\t\t\tdata-placement=\"right\">host1</a></td>\n      ";
            expect(normalize(html)).toBe(normalize(expectedHtml));
        });
        it('Array column should not use number as formatter', function () {
            var html = renderer.renderCell(8, 0, ['value1', 'value2']);
            expect(html).toBe('<td>value1, value2</td>');
        });
        it('numeric value should be mapped to text', function () {
            var html = renderer.renderCell(9, 0, 1);
            expect(html).toBe('<td>on</td>');
        });
        it('string numeric value should be mapped to text', function () {
            var html = renderer.renderCell(9, 0, '0');
            expect(html).toBe('<td>off</td>');
        });
        it('string value should be mapped to text', function () {
            var html = renderer.renderCell(9, 0, 'HELLO WORLD');
            expect(html).toBe('<td>HELLO GRAFANA</td>');
        });
        it('array column value should be mapped to text', function () {
            var html = renderer.renderCell(9, 0, ['value1', 'value2']);
            expect(html).toBe('<td>value3, value4</td>');
        });
        it('value should be mapped to text (range)', function () {
            var html = renderer.renderCell(10, 0, 2);
            expect(html).toBe('<td>on</td>');
        });
        it('value should be mapped to text (range)', function () {
            var html = renderer.renderCell(10, 0, 5);
            expect(html).toBe('<td>off</td>');
        });
        it('array column value should not be mapped to text', function () {
            var html = renderer.renderCell(10, 0, ['value1', 'value2']);
            expect(html).toBe('<td>value1, value2</td>');
        });
        it('value should be mapped to text and colored cell should have style', function () {
            var html = renderer.renderCell(11, 0, 1);
            expect(html).toBe("<td style=\"color:" + '#FF780A' + "\">on</td>");
        });
        it('value should be mapped to text and colored cell should have style', function () {
            var html = renderer.renderCell(11, 0, '1');
            expect(html).toBe("<td style=\"color:" + '#FF780A' + "\">on</td>");
        });
        it('value should be mapped to text and colored cell should have style', function () {
            var html = renderer.renderCell(11, 0, 0);
            expect(html).toBe('<td style="color:#00ff00">off</td>');
        });
        it('value should be mapped to text and colored cell should have style', function () {
            var html = renderer.renderCell(11, 0, '0');
            expect(html).toBe('<td style="color:#00ff00">off</td>');
        });
        it('value should be mapped to text and colored cell should have style', function () {
            var html = renderer.renderCell(11, 0, '2.1');
            expect(html).toBe('<td style="color:rgb(1,0,0)">2.1</td>');
        });
        it('value should be mapped to text (range) and colored cell should have style', function () {
            var html = renderer.renderCell(12, 0, 0);
            expect(html).toBe('<td style="color:#00ff00">0</td>');
        });
        it('value should be mapped to text (range) and colored cell should have style', function () {
            var html = renderer.renderCell(12, 0, 1);
            expect(html).toBe('<td style="color:#00ff00">on</td>');
        });
        it('value should be mapped to text (range) and colored cell should have style', function () {
            var html = renderer.renderCell(12, 0, 4);
            expect(html).toBe("<td style=\"color:" + '#FF780A' + "\">off</td>");
        });
        it('value should be mapped to text (range) and colored cell should have style', function () {
            var html = renderer.renderCell(12, 0, '7.1');
            expect(html).toBe('<td style="color:rgb(1,0,0)">7.1</td>');
        });
        it('hidden columns should not be rendered', function () {
            var html = renderer.renderCell(13, 0, 'ignored');
            expect(html).toBe('');
        });
        it('right aligned column should have correct text-align style', function () {
            var html = renderer.renderCell(14, 0, 42);
            expect(html).toBe('<td style="text-align:right">42</td>');
        });
        it('render_values should ignore hidden columns', function () {
            renderer.render(0); // this computes the hidden markers on the columns
            var _a = renderer.render_values(), columns = _a.columns, rows = _a.rows;
            expect(rows).toHaveLength(1);
            expect(columns).toHaveLength(table.columns.length - 1);
            expect(columns.filter(function (col) { return col.hidden; })).toHaveLength(0);
        });
    });
});
describe('when rendering table with different patterns', function () {
    it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    column                 | pattern                        | expected\n    ", " | ", "   | ", "\n    ", " | ", " | ", "\n    ", " | ", "         | ", "\n    ", " | ", "     | ", "\n    ", " | ", "                      | ", "\n    ", " | ", "                      | ", "\n    ", " | ", "       | ", "\n    ", " | ", "         | ", "\n  "], ["\n    column                 | pattern                        | expected\n    ", " | ", "   | ", "\n    ", " | ", " | ", "\n    ", " | ", "         | ", "\n    ", " | ", "     | ", "\n    ", " | ", "                      | ", "\n    ", " | ", "                      | ", "\n    ", " | ", "       | ", "\n    ", " | ", "         | ", "\n  "])), 'Requests (Failed)', '/Requests \\(Failed\\)/', '<td>1.230 s</td>', 'Requests (Failed)', '/(Req)uests \\(Failed\\)/', '<td>1.230 s</td>', 'Requests (Failed)', 'Requests (Failed)', '<td>1.230 s</td>', 'Requests (Failed)', 'Requests \\(Failed\\)', '<td>1.230 s</td>', 'Requests (Failed)', '/.*/', '<td>1.230 s</td>', 'Some other column', '/.*/', '<td>1.230 s</td>', 'Requests (Failed)', '/Requests (Failed)/', '<td>1230</td>', 'Requests (Failed)', 'Response (Failed)', '<td>1230</td>')('number column should be formatted for a column:$column with the pattern:$pattern', function (_a) {
        var column = _a.column, pattern = _a.pattern, expected = _a.expected;
        var table = new TableModel();
        table.columns = [{ text: 'Time' }, { text: column }];
        table.rows = [[1388556366666, 1230]];
        var panel = {
            pageSize: 10,
            styles: [
                {
                    pattern: 'Time',
                    type: 'date',
                    format: 'LLL',
                    alias: 'Timestamp',
                },
                {
                    pattern: pattern,
                    type: 'number',
                    unit: 'ms',
                    decimals: 3,
                    alias: pattern,
                },
            ],
        };
        //@ts-ignore
        var renderer = new TableRenderer(panel, table, utc, sanitize, templateSrv, getTheme());
        var html = renderer.renderCell(1, 0, 1230);
        expect(html).toBe(expected);
    });
});
describe('when rendering cells with different alignment options', function () {
    var cases = [
        //align, preserve fmt, color mode, expected
        ['', false, null, '<td>42</td>'],
        ['invalid_option', false, null, '<td>42</td>'],
        ['alert("no xss");', false, null, '<td>42</td>'],
        ['auto', false, null, '<td>42</td>'],
        ['justify', false, null, '<td>42</td>'],
        ['auto', true, null, '<td class="table-panel-cell-pre">42</td>'],
        ['left', false, null, '<td style="text-align:left">42</td>'],
        ['left', true, null, '<td class="table-panel-cell-pre" style="text-align:left">42</td>'],
        ['center', false, null, '<td style="text-align:center">42</td>'],
        [
            'center',
            true,
            'cell',
            '<td class="table-panel-color-cell table-panel-cell-pre" style="background-color:rgba(50, 172, 45, 0.97);text-align:center">42</td>',
        ],
        [
            'right',
            false,
            'cell',
            '<td class="table-panel-color-cell" style="background-color:rgba(50, 172, 45, 0.97);text-align:right">42</td>',
        ],
        [
            'right',
            true,
            'cell',
            '<td class="table-panel-color-cell table-panel-cell-pre" style="background-color:rgba(50, 172, 45, 0.97);text-align:right">42</td>',
        ],
    ];
    it.each(cases)('align option:"%s", preformatted:%s columns should be formatted with correct style', function (align, preserveFormat, colorMode, expected) {
        var table = new TableModel();
        table.columns = [{ text: 'Time' }, { text: align }];
        table.rows = [[0, 42]];
        var panel = {
            pageSize: 10,
            styles: [
                {
                    pattern: 'Time',
                    type: 'date',
                    format: 'LLL',
                    alias: 'Timestamp',
                },
                {
                    pattern: "/" + align + "/",
                    align: align,
                    type: 'number',
                    unit: 'none',
                    preserveFormat: preserveFormat,
                    colorMode: colorMode,
                    thresholds: [1, 2],
                    colors: ['rgba(245, 54, 54, 0.9)', 'rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'],
                },
            ],
        };
        //@ts-ignore
        var renderer = new TableRenderer(panel, table, utc, sanitize, templateSrv, getTheme());
        var html = renderer.renderCell(1, 0, 42);
        expect(html).toBe(expected);
    });
});
function normalize(str) {
    return str.replace(/\s+/gm, ' ').trim();
}
var templateObject_1;
//# sourceMappingURL=renderer.test.js.map
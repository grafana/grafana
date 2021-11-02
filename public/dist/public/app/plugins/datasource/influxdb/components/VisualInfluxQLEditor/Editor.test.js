import { __assign } from "tslib";
import React from 'react';
import { render } from '@testing-library/react';
import { Editor } from './Editor';
// we mock the @grafana/ui components we use to make sure they just show their "value".
// we mostly need this for `Input`, because that one is not visible with `.textContent`,
// but i have decided to do all we use to be consistent here.
jest.mock('@grafana/ui', function () {
    var Input = function (_a) {
        var value = _a.value, placeholder = _a.placeholder;
        return (React.createElement("span", null,
            "[",
            value || placeholder,
            "]"));
    };
    var WithContextMenu = function (_a) {
        var children = _a.children;
        return (React.createElement("span", null,
            "[",
            children({ openMenu: undefined }),
            "]"));
    };
    var Select = function (_a) {
        var value = _a.value;
        return React.createElement("span", null,
            "[",
            value,
            "]");
    };
    var orig = jest.requireActual('@grafana/ui');
    return __assign(__assign({}, orig), { Input: Input, WithContextMenu: WithContextMenu, Select: Select });
});
jest.mock('./Seg', function () {
    var Seg = function (_a) {
        var value = _a.value;
        return React.createElement("span", null,
            "[",
            value,
            "]");
    };
    return {
        Seg: Seg,
    };
});
function assertEditor(query, textContent) {
    var onChange = jest.fn();
    var onRunQuery = jest.fn();
    var datasource = {};
    var container = render(React.createElement(Editor, { query: query, datasource: datasource, onChange: onChange, onRunQuery: onRunQuery })).container;
    expect(container.textContent).toBe(textContent);
}
describe('InfluxDB InfluxQL Visual Editor', function () {
    it('should handle minimal query', function () {
        var query = {
            refId: 'A',
        };
        assertEditor(query, 'FROM[default][select measurement]WHERE[+]' +
            'SELECT[field]([value])[mean]()[+]' +
            'GROUP BY[time]([$__interval])[fill]([null])[+]' +
            'TIMEZONE[(optional)]ORDER BY TIME[ASC]' +
            'LIMIT[(optional)]SLIMIT[(optional)]' +
            'FORMAT AS[time_series]ALIAS[Naming pattern]');
    });
    it('should have the alias-field hidden when format-as-table', function () {
        var query = {
            refId: 'A',
            alias: 'test-alias',
            resultFormat: 'table',
        };
        assertEditor(query, 'FROM[default][select measurement]WHERE[+]' +
            'SELECT[field]([value])[mean]()[+]' +
            'GROUP BY[time]([$__interval])[fill]([null])[+]' +
            'TIMEZONE[(optional)]ORDER BY TIME[ASC]' +
            'LIMIT[(optional)]SLIMIT[(optional)]' +
            'FORMAT AS[table]');
    });
    it('should handle complex query', function () {
        var query = {
            refId: 'A',
            policy: 'default',
            resultFormat: 'logs',
            orderByTime: 'DESC',
            tags: [
                {
                    key: 'cpu',
                    operator: '=',
                    value: 'cpu1',
                },
                {
                    condition: 'AND',
                    key: 'cpu',
                    operator: '<',
                    value: 'cpu3',
                },
            ],
            groupBy: [
                {
                    type: 'time',
                    params: ['$__interval'],
                },
                {
                    type: 'tag',
                    params: ['cpu'],
                },
                {
                    type: 'tag',
                    params: ['host'],
                },
                {
                    type: 'fill',
                    params: ['null'],
                },
            ],
            select: [
                [
                    {
                        type: 'field',
                        params: ['usage_idle'],
                    },
                    {
                        type: 'mean',
                        params: [],
                    },
                ],
                [
                    {
                        type: 'field',
                        params: ['usage_guest'],
                    },
                    {
                        type: 'median',
                        params: [],
                    },
                    {
                        type: 'holt_winters_with_fit',
                        params: [10, 2],
                    },
                ],
            ],
            measurement: 'cpu',
            limit: '4',
            slimit: '5',
            tz: 'UTC',
            alias: 'all i as',
        };
        assertEditor(query, 'FROM[default][cpu]WHERE[cpu][=][cpu1][AND][cpu][<][cpu3][+]' +
            'SELECT[field]([usage_idle])[mean]()[+]' +
            '[field]([usage_guest])[median]()[holt_winters_with_fit]([10],[2])[+]' +
            'GROUP BY[time]([$__interval])[tag]([cpu])[tag]([host])[fill]([null])[+]' +
            'TIMEZONE[UTC]ORDER BY TIME[DESC]' +
            'LIMIT[4]SLIMIT[5]' +
            'FORMAT AS[logs]ALIAS[all i as]');
    });
});
//# sourceMappingURL=Editor.test.js.map
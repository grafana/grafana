import { __awaiter } from "tslib";
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { getMockInfluxDS, getMockDSInstanceSettings } from '../../../../../mocks';
import { DEFAULT_POLICY } from '../../../../../types';
import { VisualInfluxQLEditor } from './VisualInfluxQLEditor';
// we mock the @grafana/ui components we use to make sure they just show their "value".
// we mostly need this for `Input`, because that one is not visible with `.textContent`,
// but i have decided to do all we use to be consistent here.
jest.mock('@grafana/ui', () => {
    const Input = ({ value, placeholder }) => (React.createElement("span", null,
        "[",
        value || placeholder,
        "]"));
    const WithContextMenu = ({ children }) => (React.createElement("span", null,
        "[",
        children({ openMenu: undefined }),
        "]"));
    const Select = ({ value }) => React.createElement("span", null,
        "[",
        value,
        "]");
    const orig = jest.requireActual('@grafana/ui');
    return Object.assign(Object.assign({}, orig), { Input,
        WithContextMenu,
        Select });
});
jest.mock('./Seg', () => {
    const Seg = ({ value }) => React.createElement("span", null,
        "[",
        value,
        "]");
    return {
        Seg,
    };
});
function assertEditor(query, textContent) {
    return __awaiter(this, void 0, void 0, function* () {
        const onChange = jest.fn();
        const onRunQuery = jest.fn();
        const datasource = getMockInfluxDS(getMockDSInstanceSettings());
        datasource.metricFindQuery = () => Promise.resolve([]);
        const { container } = render(React.createElement(VisualInfluxQLEditor, { query: query, datasource: datasource, onChange: onChange, onRunQuery: onRunQuery }));
        yield waitFor(() => {
            expect(container.textContent).toBe(textContent);
        });
    });
}
describe('InfluxDB InfluxQL Visual Editor', () => {
    it('should handle minimal query', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = {
            refId: 'A',
            policy: DEFAULT_POLICY,
        };
        yield assertEditor(query, 'FROM[default][select measurement]WHERE[+]' +
            'SELECT[field]([value])[mean]()[+]' +
            'GROUP BY[time]([$__interval])[fill]([null])[+]' +
            'TIMEZONE[(optional)]ORDER BY TIME[ASC]' +
            'LIMIT[(optional)]SLIMIT[(optional)]' +
            'FORMAT AS[time_series]ALIAS[Naming pattern]');
    }));
    it('should have the alias-field hidden when format-as-table', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = {
            refId: 'A',
            alias: 'test-alias',
            resultFormat: 'table',
            policy: DEFAULT_POLICY,
        };
        yield assertEditor(query, 'FROM[default][select measurement]WHERE[+]' +
            'SELECT[field]([value])[mean]()[+]' +
            'GROUP BY[time]([$__interval])[fill]([null])[+]' +
            'TIMEZONE[(optional)]ORDER BY TIME[ASC]' +
            'LIMIT[(optional)]SLIMIT[(optional)]' +
            'FORMAT AS[table]');
    }));
    it('should handle complex query', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = {
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
        yield assertEditor(query, 'FROM[default][cpu]WHERE[cpu][=][cpu1][AND][cpu][<][cpu3][+]' +
            'SELECT[field]([usage_idle])[mean]()[+]' +
            '[field]([usage_guest])[median]()[holt_winters_with_fit]([10],[2])[+]' +
            'GROUP BY[time]([$__interval])[tag]([cpu])[tag]([host])[fill]([null])[+]' +
            'TIMEZONE[UTC]ORDER BY TIME[DESC]' +
            'LIMIT[4]SLIMIT[5]' +
            'FORMAT AS[logs]ALIAS[all i as]');
    }));
});
//# sourceMappingURL=VisualInfluxQLEditor.test.js.map
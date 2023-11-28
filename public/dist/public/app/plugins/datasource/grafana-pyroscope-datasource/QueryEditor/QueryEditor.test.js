import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CoreApp, PluginType } from '@grafana/data';
import { PyroscopeDataSource } from '../datasource';
import { QueryEditor } from './QueryEditor';
describe('QueryEditor', () => {
    it('should render without error', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(yield screen.findByDisplayValue('process_cpu-cpu')).toBeDefined();
    }));
    it('should render without error if empty profileTypes', () => __awaiter(void 0, void 0, void 0, function* () {
        const ds = setupDs();
        ds.getProfileTypes = jest.fn().mockResolvedValue([]);
        setup({
            props: {
                datasource: ds,
                query: {
                    queryType: 'both',
                    labelSelector: '',
                    profileTypeId: '',
                    refId: 'A',
                    maxNodes: 1000,
                    groupBy: [],
                },
            },
        });
        expect(yield screen.findByPlaceholderText('No profile types found')).toBeDefined();
    }));
    it('should render options', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield openOptions();
        expect(screen.getByText(/Metric/)).toBeDefined();
        expect(screen.getByText(/Profile/)).toBeDefined();
        expect(screen.getByText(/Both/)).toBeDefined();
        expect(screen.getByText(/Group by/)).toBeDefined();
    }));
    it('should render correct options outside of explore', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ props: { app: CoreApp.Dashboard } });
        yield openOptions();
        expect(screen.getByText(/Metric/)).toBeDefined();
        expect(screen.getByText(/Profile/)).toBeDefined();
        expect(screen.queryAllByText(/Both/).length).toBe(0);
    }));
});
function openOptions() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = screen.getByText(/Options/);
        expect(options).toBeDefined();
        yield userEvent.click(options);
    });
}
function setupDs() {
    const ds = new PyroscopeDataSource({
        name: 'test',
        uid: 'test',
        type: PluginType.datasource,
        access: 'proxy',
        id: 1,
        jsonData: {},
        meta: {
            name: '',
            id: '',
            type: PluginType.datasource,
            baseUrl: '',
            info: {
                author: {
                    name: '',
                },
                description: '',
                links: [],
                logos: {
                    large: '',
                    small: '',
                },
                screenshots: [],
                updated: '',
                version: '',
            },
            module: '',
        },
        readOnly: false,
    });
    ds.getProfileTypes = jest.fn().mockResolvedValue([
        {
            label: 'process_cpu - cpu',
            id: 'process_cpu:cpu',
        },
        {
            label: 'memory',
            id: 'memory:memory',
        },
    ]);
    return ds;
}
function setup(options = { props: {} }) {
    const onChange = jest.fn();
    const utils = render(React.createElement(QueryEditor, Object.assign({ query: {
            queryType: 'both',
            labelSelector: '',
            profileTypeId: 'process_cpu:cpu',
            refId: 'A',
            maxNodes: 1000,
            groupBy: [],
        }, datasource: setupDs(), onChange: onChange, onRunQuery: () => { }, app: CoreApp.Explore }, options.props)));
    return Object.assign(Object.assign({}, utils), { onChange });
}
//# sourceMappingURL=QueryEditor.test.js.map
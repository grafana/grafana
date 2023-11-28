import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CoreApp, PluginType } from '@grafana/data';
import { ParcaDataSource } from '../datasource';
import { QueryEditor } from './QueryEditor';
describe('QueryEditor', () => {
    it('should render without error', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(screen.findByText('process_cpu:cpu')).toBeDefined();
    }));
    it('should render options', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        yield openOptions();
        expect(screen.getByText(/Metric/)).toBeDefined();
        expect(screen.getByText(/Profile/)).toBeDefined();
        expect(screen.getByText(/Both/)).toBeDefined();
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
function setup(options = { props: {} }) {
    const onChange = jest.fn();
    const ds = new ParcaDataSource({
        name: 'test',
        uid: 'test',
        type: PluginType.datasource,
        access: 'proxy',
        id: 1,
        jsonData: {},
        meta: {},
        readOnly: false,
    });
    ds.getProfileTypes = jest.fn().mockResolvedValue([
        {
            name: 'process_cpu',
            ID: 'process_cpu:cpu',
            period_type: 'day',
            period_unit: 's',
            sample_unit: 'ms',
            sample_type: 'cpu',
        },
        {
            name: 'memory',
            ID: 'memory:memory',
            period_type: 'day',
            period_unit: 's',
            sample_unit: 'ms',
            sample_type: 'memory',
        },
    ]);
    const utils = render(React.createElement(QueryEditor, Object.assign({ query: {
            queryType: 'both',
            labelSelector: '',
            profileTypeId: 'process_cpu:cpu',
            refId: 'A',
        }, datasource: ds, onChange: onChange, onRunQuery: () => { }, app: CoreApp.Explore }, options.props)));
    return Object.assign(Object.assign({}, utils), { onChange });
}
//# sourceMappingURL=QueryEditor.test.js.map
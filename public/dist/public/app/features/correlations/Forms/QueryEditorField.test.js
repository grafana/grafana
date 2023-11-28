import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { setDataSourceSrv } from '@grafana/runtime';
import { MockDataSourceSrv } from 'app/features/alerting/unified/mocks';
import { QueryEditorField } from './QueryEditorField';
const Wrapper = ({ children }) => {
    const methods = useForm({ defaultValues: { query: {} } });
    return React.createElement(FormProvider, Object.assign({}, methods), children);
};
const defaultGetHandler = (name) => __awaiter(void 0, void 0, void 0, function* () {
    const dsApi = new MockDataSourceApi(name);
    dsApi.components = {
        QueryEditor: () => React.createElement(React.Fragment, null,
            name,
            " query editor"),
    };
    return dsApi;
});
const renderWithContext = (children, getHandler = defaultGetHandler) => {
    const dsServer = new MockDataSourceSrv({});
    dsServer.get = getHandler;
    setDataSourceSrv(dsServer);
    render(React.createElement(Wrapper, null, children));
};
describe('QueryEditorField', () => {
    afterAll(() => {
        jest.restoreAllMocks();
    });
    it('should render the query editor', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithContext(React.createElement(QueryEditorField, { name: "query", dsUid: "test" }));
        expect(yield screen.findByText('test query editor')).toBeInTheDocument();
    }));
    it("shows an error alert when datasource can't be loaded", () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithContext(React.createElement(QueryEditorField, { name: "query", dsUid: "something" }), () => {
            throw new Error('Unable to load datasource');
        });
        expect(yield screen.findByRole('alert', { name: 'Error loading data source' })).toBeInTheDocument();
    }));
    it('shows an info alert when no datasource is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithContext(React.createElement(QueryEditorField, { name: "query" }));
        expect(yield screen.findByRole('status', { name: 'No data source selected' })).toBeInTheDocument();
    }));
    it('shows an info alert when datasaource does not export a query editor', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithContext(React.createElement(QueryEditorField, { name: "query", dsUid: "something" }), (name) => __awaiter(void 0, void 0, void 0, function* () {
            return new MockDataSourceApi(name);
        }));
        expect(yield screen.findByRole('alert', { name: 'Data source does not export a query editor.' })).toBeInTheDocument();
    }));
});
//# sourceMappingURL=QueryEditorField.test.js.map
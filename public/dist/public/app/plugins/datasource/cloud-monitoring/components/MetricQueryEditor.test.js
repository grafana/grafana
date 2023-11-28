import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { createMockDatasource } from '../__mocks__/cloudMonitoringDatasource';
import { createMockQuery } from '../__mocks__/cloudMonitoringQuery';
import { QueryType } from '../types/query';
import { MetricQueryEditor } from './MetricQueryEditor';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        replace: (val) => val,
    }) })));
const defaultProps = {
    refId: 'A',
    customMetaData: {},
    variableOptionGroup: { options: [] },
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
    query: createMockQuery(),
    datasource: createMockDatasource(),
};
describe('MetricQueryEditor', () => {
    it('renders a default time series list query', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const query = createMockQuery();
        // Force to populate with default values
        delete query.timeSeriesList;
        render(React.createElement(MetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, query: query })));
        expect(onChange).toHaveBeenCalled();
    }));
    it('renders a default time series query', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const query = createMockQuery();
        // Force to populate with default values
        delete query.timeSeriesQuery;
        query.queryType = QueryType.TIME_SERIES_QUERY;
        render(React.createElement(MetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, query: query })));
        expect(onChange).toHaveBeenCalled();
    }));
    it('renders an annotation query', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const query = createMockQuery();
        query.queryType = QueryType.ANNOTATION;
        render(React.createElement(MetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, query: query })));
        const l = yield screen.findByLabelText('Project');
        expect(l).toBeInTheDocument();
    }));
    it('renders a Project dropdown', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = createMockQuery();
        query.queryType = QueryType.TIME_SERIES_QUERY;
        render(React.createElement(MetricQueryEditor, Object.assign({}, defaultProps)));
        const projectDropdown = yield screen.findByLabelText('Project');
        expect(projectDropdown).toBeInTheDocument();
    }));
    it('preserves the aliasBy property when switching between Builder and MQL queries', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = createMockQuery({ aliasBy: 'AliasTest' });
        query.queryType = QueryType.TIME_SERIES_QUERY;
        render(React.createElement(MetricQueryEditor, Object.assign({}, defaultProps, { query: query })));
        yield waitFor(() => expect(screen.getByLabelText('Alias by').closest('input').value).toEqual('AliasTest'));
        query.queryType = QueryType.TIME_SERIES_LIST;
        render(React.createElement(MetricQueryEditor, Object.assign({}, defaultProps, { query: query })));
        yield waitFor(() => expect(screen.getByLabelText('Alias by').closest('input').value).toEqual('AliasTest'));
    }));
});
//# sourceMappingURL=MetricQueryEditor.test.js.map
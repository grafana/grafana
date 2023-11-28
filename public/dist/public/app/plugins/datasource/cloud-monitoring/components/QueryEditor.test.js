import { __awaiter } from "tslib";
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { createMockDatasource } from '../__mocks__/cloudMonitoringDatasource';
import { createMockQuery } from '../__mocks__/cloudMonitoringQuery';
import { QueryType } from '../types/query';
import { QueryEditor } from './QueryEditor';
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
describe('QueryEditor', () => {
    it('should migrate the given query', () => __awaiter(void 0, void 0, void 0, function* () {
        const datasource = createMockDatasource();
        const onChange = jest.fn();
        datasource.migrateQuery = jest.fn().mockReturnValue(defaultProps.query);
        render(React.createElement(QueryEditor, Object.assign({}, defaultProps, { datasource: datasource, onChange: onChange })));
        yield waitFor(() => expect(datasource.migrateQuery).toHaveBeenCalledTimes(1));
        yield waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        yield waitFor(() => expect(onChange).toHaveBeenCalledWith(defaultProps.query));
    }));
    it('should set a known query type', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = createMockQuery();
        query.queryType = 'other';
        const onChange = jest.fn();
        render(React.createElement(QueryEditor, Object.assign({}, defaultProps, { query: query, onChange: onChange })));
        yield waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ queryType: QueryType.TIME_SERIES_LIST })));
    }));
});
//# sourceMappingURL=QueryEditor.test.js.map
import { __awaiter } from "tslib";
import { fireEvent, queryByLabelText, render, screen } from '@testing-library/react';
import React from 'react';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import createMockPanelData from 'app/plugins/datasource/azuremonitor/__mocks__/panelData';
import { QueryEditorRows } from './QueryEditorRows';
const mockDS = mockDataSource({
    name: 'CloudManager',
    type: DataSourceType.Alertmanager,
});
const mockVariable = mockDataSource({
    name: '${dsVariable}',
    type: 'datasource',
});
jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
    return {
        getDataSourceSrv: () => ({
            get: () => Promise.resolve(Object.assign(Object.assign({}, mockDS), { getRef: () => { } })),
            getList: ({ variables }) => (variables ? [mockDS, mockVariable] : [mockDS]),
            getInstanceSettings: () => (Object.assign(Object.assign({}, mockDS), { meta: Object.assign(Object.assign({}, mockDS.meta), { alerting: true, mixed: true }) })),
        }),
    };
});
const props = {
    queries: [
        {
            datasource: mockDS,
            refId: 'A',
        },
        {
            datasource: mockDS,
            refId: 'B',
        },
    ],
    dsSettings: mockDataSource(),
    onQueriesChange: function (queries) {
        throw new Error('Function not implemented.');
    },
    onAddQuery: function (query) {
        throw new Error('Function not implemented.');
    },
    onRunQueries: function () {
        throw new Error('Function not implemented.');
    },
    data: createMockPanelData(),
};
jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
    return {
        getDataSourceSrv: () => ({
            get: () => Promise.resolve(mockDS),
            getList: ({ variables }) => (variables ? [mockDS, mockVariable] : [mockDS]),
            getInstanceSettings: () => mockDS,
        }),
    };
});
describe('QueryEditorRows', () => {
    it('Should render queries', () => __awaiter(void 0, void 0, void 0, function* () {
        const { renderResult: { rerender }, } = renderScenario();
        expect((yield screen.findByTestId('query-editor-rows')).children.length).toBe(2);
        rerender(React.createElement(QueryEditorRows, Object.assign({}, props, { queries: [
                {
                    datasource: mockDS,
                    refId: 'A',
                },
            ] })));
        expect((yield screen.findByTestId('query-editor-rows')).children.length).toBe(1);
    }));
    it('Should be able to expand and collapse queries', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario();
        const queryEditorRows = yield screen.findAllByTestId('query-editor-row');
        for (const childQuery of queryEditorRows) {
            const toggleExpandButton = queryByLabelText(childQuery, 'Collapse query row');
            expect(toggleExpandButton).toBeInTheDocument();
            expect(toggleExpandButton.getAttribute('aria-expanded')).toBe('true');
            fireEvent.click(toggleExpandButton);
            expect(toggleExpandButton.getAttribute('aria-expanded')).toBe('false');
        }
    }));
    it('Should be able to duplicate queries', () => __awaiter(void 0, void 0, void 0, function* () {
        const onAddQuery = jest.fn();
        const onQueryCopied = jest.fn();
        renderScenario({ onAddQuery, onQueryCopied });
        const queryEditorRows = yield screen.findAllByTestId('query-editor-row');
        queryEditorRows.map((childQuery) => __awaiter(void 0, void 0, void 0, function* () {
            const duplicateQueryButton = queryByLabelText(childQuery, 'Duplicate query');
            expect(duplicateQueryButton).toBeInTheDocument();
            fireEvent.click(duplicateQueryButton);
        }));
        expect(onAddQuery).toHaveBeenCalledTimes(queryEditorRows.length);
        expect(onQueryCopied).toHaveBeenCalledTimes(queryEditorRows.length);
    }));
    it('Should be able to delete queries', () => __awaiter(void 0, void 0, void 0, function* () {
        const onQueriesChange = jest.fn();
        const onQueryRemoved = jest.fn();
        renderScenario({ onQueriesChange, onQueryRemoved });
        const queryEditorRows = yield screen.findAllByTestId('query-editor-row');
        queryEditorRows.map((childQuery) => __awaiter(void 0, void 0, void 0, function* () {
            const deleteQueryButton = queryByLabelText(childQuery, 'Remove query');
            expect(deleteQueryButton).toBeInTheDocument();
            fireEvent.click(deleteQueryButton);
        }));
        expect(onQueriesChange).toHaveBeenCalledTimes(queryEditorRows.length);
        expect(onQueryRemoved).toHaveBeenCalledTimes(queryEditorRows.length);
    }));
});
function renderScenario(overrides) {
    Object.assign(props, overrides);
    return {
        renderResult: render(React.createElement(QueryEditorRows, Object.assign({}, props))),
    };
}
//# sourceMappingURL=QueryEditorRows.test.js.map
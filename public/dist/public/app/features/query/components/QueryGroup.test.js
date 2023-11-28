import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import config from 'app/core/config';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { PanelQueryRunner } from '../state/PanelQueryRunner';
import { QueryGroup } from './QueryGroup';
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
describe('QueryGroup', () => {
    // QueryGroup relies on this being present
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: jest.fn() });
    beforeEach(() => {
        config.expressionsEnabled = true;
    });
    it('Should add expression on click', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario({});
        const addExpressionButton = yield screen.findByTestId('query-tab-add-expression');
        const queryRowsContainer = yield screen.findByTestId('query-editor-rows');
        expect(queryRowsContainer.children.length).toBe(2);
        yield userEvent.click(addExpressionButton);
        yield waitFor(() => {
            expect(queryRowsContainer.children.length).toBe(3);
        });
    }));
    it('Should add query on click', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario({});
        const addQueryButton = yield screen.findByRole('button', { name: /Add query/i });
        const queryRowsContainer = yield screen.findByTestId('query-editor-rows');
        expect(queryRowsContainer.children.length).toBe(2);
        yield userEvent.click(addQueryButton);
        yield waitFor(() => {
            expect(queryRowsContainer.children.length).toBe(3);
        });
    }));
    it('New expression should be expanded', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        renderScenario({});
        const addExpressionButton = yield screen.findByTestId('query-tab-add-expression');
        const queryRowsContainer = yield screen.findByTestId('query-editor-rows');
        yield userEvent.click(addExpressionButton);
        const lastQueryEditorRow = (yield screen.findAllByTestId('query-editor-row')).at(-1);
        const lastEditorToggleRow = (yield screen.findAllByLabelText('Collapse query row')).at(-1);
        expect(lastEditorToggleRow === null || lastEditorToggleRow === void 0 ? void 0 : lastEditorToggleRow.getAttribute('aria-expanded')).toBe('true');
        expect((_a = lastQueryEditorRow === null || lastQueryEditorRow === void 0 ? void 0 : lastQueryEditorRow.firstElementChild) === null || _a === void 0 ? void 0 : _a.children.length).toBe(2);
        yield waitFor(() => {
            expect(queryRowsContainer.children.length).toBe(3);
        });
    }));
    it('New query should be expanded', () => __awaiter(void 0, void 0, void 0, function* () {
        var _b;
        renderScenario({});
        const addQueryButton = yield screen.findByRole('button', { name: /Add query/i });
        const queryRowsContainer = yield screen.findByTestId('query-editor-rows');
        yield userEvent.click(addQueryButton);
        const lastQueryEditorRow = (yield screen.findAllByTestId('query-editor-row')).at(-1);
        const lastEditorToggleRow = (yield screen.findAllByLabelText('Collapse query row')).at(-1);
        expect(lastEditorToggleRow === null || lastEditorToggleRow === void 0 ? void 0 : lastEditorToggleRow.getAttribute('aria-expanded')).toBe('true');
        expect((_b = lastQueryEditorRow === null || lastQueryEditorRow === void 0 ? void 0 : lastQueryEditorRow.firstElementChild) === null || _b === void 0 ? void 0 : _b.children.length).toBe(2);
        yield waitFor(() => {
            expect(queryRowsContainer.children.length).toBe(3);
        });
    }));
    it('Should open data source help modal', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario({});
        const openHelpButton = yield screen.findByTestId('query-tab-help-button');
        yield userEvent.click(openHelpButton);
        const helpModal = yield screen.findByRole('dialog');
        expect(helpModal).toBeInTheDocument();
    }));
    it('Should not show add expression button when expressions are disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        config.expressionsEnabled = false;
        renderScenario({});
        yield screen.findByRole('button', { name: /Add query/i });
        const addExpressionButton = screen.queryByTestId('query-tab-add-expression');
        expect(addExpressionButton).not.toBeInTheDocument();
    }));
    describe('Angular deprecation', () => {
        const deprecationText = /legacy platform based on AngularJS/i;
        const oldAngularDetected = mockDS.angularDetected;
        const oldDatasources = config.datasources;
        afterEach(() => {
            mockDS.angularDetected = oldAngularDetected;
            config.datasources = oldDatasources;
        });
        it('Should render angular deprecation notice for angular plugins', () => __awaiter(void 0, void 0, void 0, function* () {
            mockDS.angularDetected = true;
            config.datasources[mockDS.name] = mockDS;
            renderScenario({});
            yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                expect(yield screen.findByText(deprecationText)).toBeInTheDocument();
            }));
        }));
        it('Should not render angular deprecation notice for non-angular plugins', () => __awaiter(void 0, void 0, void 0, function* () {
            mockDS.angularDetected = false;
            config.datasources[mockDS.name] = mockDS;
            renderScenario({});
            yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                expect(yield screen.queryByText(deprecationText)).not.toBeInTheDocument();
            }));
        }));
    });
});
function renderScenario(overrides) {
    const props = {
        onOptionsChange: jest.fn(),
        queryRunner: new PanelQueryRunner({
            getDataSupport: jest.fn(),
            getFieldOverrideOptions: jest.fn(),
            getTransformations: jest.fn(),
        }),
        options: {
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
            dataSource: mockDS,
        },
        onRunQueries: function () {
            throw new Error('Function not implemented.');
        },
    };
    Object.assign(props, overrides);
    return {
        props,
        renderResult: render(React.createElement(QueryGroup, Object.assign({}, props))),
    };
}
//# sourceMappingURL=QueryGroup.test.js.map
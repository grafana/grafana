import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { openMenu } from 'react-select-event';
import { selectors } from '@grafana/e2e-selectors';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { QueryEditorRowHeader } from './QueryEditorRowHeader';
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
            get: () => Promise.resolve(mockDS),
            getList: ({ variables }) => (variables ? [mockDS, mockVariable] : [mockDS]),
            getInstanceSettings: () => mockDS,
        }),
    };
});
describe('QueryEditorRowHeader', () => {
    it('Can edit title', () => __awaiter(void 0, void 0, void 0, function* () {
        const scenario = renderScenario({});
        yield userEvent.click(screen.getByTestId('query-name-div'));
        const input = screen.getByTestId('query-name-input');
        yield userEvent.clear(input);
        yield userEvent.type(input, 'new name');
        // blur the field
        yield userEvent.click(document.body);
        expect(jest.mocked(scenario.props.onChange).mock.calls[0][0].refId).toBe('new name');
    }));
    it('Show error when other query with same name exists', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario({});
        yield userEvent.click(screen.getByTestId('query-name-div'));
        const input = screen.getByTestId('query-name-input');
        yield userEvent.clear(input);
        yield userEvent.type(input, 'B');
        const alert = yield screen.findByRole('alert');
        expect(alert.textContent).toBe('Query name already exists');
    }));
    it('Show error when empty name is specified', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario({});
        yield userEvent.click(screen.getByTestId('query-name-div'));
        const input = screen.getByTestId('query-name-input');
        yield userEvent.clear(input);
        const alert = yield screen.findByRole('alert');
        expect(alert.textContent).toBe('An empty query name is not allowed');
    }));
    it('should show data source picker when callback is passed', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario({ onChangeDataSource: () => { } });
        expect(screen.queryByTestId(selectors.components.DataSourcePicker.container)).not.toBeNull();
    }));
    it('should not show data source picker when no callback is passed', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario({ onChangeDataSource: undefined });
        expect(screen.queryByTestId(selectors.components.DataSourcePicker.container)).toBeNull();
    }));
    it('should render variables in the data source picker', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario({ onChangeDataSource: () => { } });
        const dsSelect = screen.getByTestId(selectors.components.DataSourcePicker.container).querySelector('input');
        openMenu(dsSelect);
        expect(yield screen.findByText('${dsVariable}')).toBeInTheDocument();
    }));
});
function renderScenario(overrides) {
    const props = {
        query: {
            refId: 'A',
        },
        queries: [
            {
                refId: 'A',
            },
            {
                refId: 'B',
            },
        ],
        dataSource: {},
        disabled: false,
        onChange: jest.fn(),
        onClick: jest.fn(),
        collapsedText: '',
    };
    Object.assign(props, overrides);
    return {
        props,
        renderResult: render(React.createElement(QueryEditorRowHeader, Object.assign({}, props))),
    };
}
//# sourceMappingURL=QueryEditorRowHeader.test.js.map
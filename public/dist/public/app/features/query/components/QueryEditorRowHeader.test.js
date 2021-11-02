import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryEditorRowHeader } from './QueryEditorRowHeader';
import { selectors } from '@grafana/e2e-selectors';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
var mockDS = mockDataSource({
    name: 'CloudManager',
    type: DataSourceType.Alertmanager,
});
jest.mock('@grafana/runtime/src/services/dataSourceSrv', function () {
    return {
        getDataSourceSrv: function () { return ({
            get: function () { return Promise.resolve(mockDS); },
            getList: function () { return [mockDS]; },
            getInstanceSettings: function () { return mockDS; },
        }); },
    };
});
describe('QueryEditorRowHeader', function () {
    it('Can edit title', function () {
        var scenario = renderScenario({});
        screen.getByTestId('query-name-div').click();
        var input = screen.getByTestId('query-name-input');
        fireEvent.change(input, { target: { value: 'new name' } });
        fireEvent.blur(input);
        expect(scenario.props.onChange.mock.calls[0][0].refId).toBe('new name');
    });
    it('Show error when other query with same name exists', function () { return __awaiter(void 0, void 0, void 0, function () {
        var input, alert;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    renderScenario({});
                    screen.getByTestId('query-name-div').click();
                    input = screen.getByTestId('query-name-input');
                    fireEvent.change(input, { target: { value: 'B' } });
                    return [4 /*yield*/, screen.findByRole('alert')];
                case 1:
                    alert = _a.sent();
                    expect(alert.textContent).toBe('Query name already exists');
                    return [2 /*return*/];
            }
        });
    }); });
    it('Show error when empty name is specified', function () { return __awaiter(void 0, void 0, void 0, function () {
        var input, alert;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    renderScenario({});
                    screen.getByTestId('query-name-div').click();
                    input = screen.getByTestId('query-name-input');
                    fireEvent.change(input, { target: { value: '' } });
                    return [4 /*yield*/, screen.findByRole('alert')];
                case 1:
                    alert = _a.sent();
                    expect(alert.textContent).toBe('An empty query name is not allowed');
                    return [2 /*return*/];
            }
        });
    }); });
    it('should show data source picker when callback is passed', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            renderScenario({ onChangeDataSource: function () { } });
            expect(screen.queryByLabelText(selectors.components.DataSourcePicker.container)).not.toBeNull();
            return [2 /*return*/];
        });
    }); });
    it('should not show data source picker when no callback is passed', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            renderScenario({ onChangeDataSource: undefined });
            expect(screen.queryByLabelText(selectors.components.DataSourcePicker.container)).toBeNull();
            return [2 /*return*/];
        });
    }); });
});
function renderScenario(overrides) {
    var props = {
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
        props: props,
        renderResult: render(React.createElement(QueryEditorRowHeader, __assign({}, props))),
    };
}
//# sourceMappingURL=QueryEditorRowHeader.test.js.map
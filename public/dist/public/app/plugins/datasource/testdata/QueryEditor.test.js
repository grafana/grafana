import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultQuery } from './constants';
import { QueryEditor } from './QueryEditor';
import { scenarios } from './__mocks__/scenarios';
import { defaultStreamQuery } from './runStreams';
beforeEach(function () {
    jest.clearAllMocks();
});
var mockOnChange = jest.fn();
var props = {
    onRunQuery: jest.fn(),
    query: defaultQuery,
    onChange: mockOnChange,
    datasource: {
        getScenarios: function () { return Promise.resolve(scenarios); },
    },
};
var setup = function (testProps) {
    var editorProps = __assign(__assign({}, props), testProps);
    return render(React.createElement(QueryEditor, __assign({}, editorProps)));
};
describe('Test Datasource Query Editor', function () {
    it('should render with default scenario', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setup();
                    _a = expect;
                    return [4 /*yield*/, screen.findByText(/random walk/i)];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    expect(screen.getByRole('textbox', { name: 'Alias' })).toBeInTheDocument();
                    expect(screen.getByRole('textbox', { name: 'Labels' })).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should switch scenario and display its default values', function () { return __awaiter(void 0, void 0, void 0, function () {
        var rerender, select, scs, _a, _b, streamQuery, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    rerender = setup().rerender;
                    return [4 /*yield*/, screen.findByText('Scenario')];
                case 1:
                    select = (_d.sent()).nextSibling;
                    return [4 /*yield*/, fireEvent.keyDown(select, { keyCode: 40 })];
                case 2:
                    _d.sent();
                    scs = screen.getAllByLabelText('Select option');
                    expect(scs).toHaveLength(scenarios.length);
                    return [4 /*yield*/, userEvent.click(screen.getByText('CSV Metric Values'))];
                case 3:
                    _d.sent();
                    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: 'csv_metric_values' }));
                    return [4 /*yield*/, rerender(React.createElement(QueryEditor, __assign({}, props, { query: __assign(__assign({}, defaultQuery), { scenarioId: 'csv_metric_values', stringInput: '1,20,90,30,5,0' }) })))];
                case 4:
                    _d.sent();
                    _a = expect;
                    return [4 /*yield*/, screen.findByRole('textbox', { name: /string input/i })];
                case 5:
                    _a.apply(void 0, [_d.sent()]).toBeInTheDocument();
                    expect(screen.getByRole('textbox', { name: /string input/i })).toHaveValue('1,20,90,30,5,0');
                    return [4 /*yield*/, fireEvent.keyDown(select, { keyCode: 40 })];
                case 6:
                    _d.sent();
                    return [4 /*yield*/, userEvent.click(screen.getByText('Grafana API'))];
                case 7:
                    _d.sent();
                    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: 'grafana_api', stringInput: 'datasources' }));
                    rerender(React.createElement(QueryEditor, __assign({}, props, { query: __assign(__assign({}, defaultQuery), { scenarioId: 'grafana_api', stringInput: 'datasources' }) })));
                    _b = expect;
                    return [4 /*yield*/, screen.findByText('Grafana API')];
                case 8:
                    _b.apply(void 0, [_d.sent()]).toBeInTheDocument();
                    expect(screen.getByText('Data Sources')).toBeInTheDocument();
                    return [4 /*yield*/, fireEvent.keyDown(select, { keyCode: 40 })];
                case 9:
                    _d.sent();
                    return [4 /*yield*/, userEvent.click(screen.getByText('Streaming Client'))];
                case 10:
                    _d.sent();
                    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: 'streaming_client', stream: defaultStreamQuery }));
                    streamQuery = __assign(__assign({}, defaultQuery), { stream: defaultStreamQuery, scenarioId: 'streaming_client' });
                    rerender(React.createElement(QueryEditor, __assign({}, props, { query: streamQuery })));
                    _c = expect;
                    return [4 /*yield*/, screen.findByText('Streaming Client')];
                case 11:
                    _c.apply(void 0, [_d.sent()]).toBeInTheDocument();
                    expect(screen.getByText('Type')).toBeInTheDocument();
                    expect(screen.getByLabelText('Noise')).toHaveValue(2.2);
                    expect(screen.getByLabelText('Speed (ms)')).toHaveValue(250);
                    expect(screen.getByLabelText('Spread')).toHaveValue(3.5);
                    expect(screen.getByLabelText('Bands')).toHaveValue(1);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=QueryEditor.test.js.map
import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import FakeSchemaData from '../../azure_log_analytics/__mocks__/schema';
import { TimeManagement } from './TimeManagement';
const variableOptionGroup = {
    label: 'Template variables',
    options: [],
};
describe('LogsQueryEditor.TimeManagement', () => {
    it('should render the column picker if Dashboard is chosen', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        const query = createMockQuery({ azureLogAnalytics: { timeColumn: undefined } });
        const onChange = jest.fn();
        const { rerender } = render(React.createElement(TimeManagement, { query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: () => { }, schema: FakeSchemaData.getLogAnalyticsFakeEngineSchema() }));
        const dashboardTimeOption = yield screen.findByLabelText('Dashboard');
        yield userEvent.click(dashboardTimeOption);
        expect(onChange).toBeCalledWith(expect.objectContaining({
            azureLogAnalytics: expect.objectContaining({
                dashboardTime: true,
            }),
        }));
        rerender(React.createElement(TimeManagement, { query: Object.assign(Object.assign({}, query), { azureLogAnalytics: Object.assign(Object.assign({}, query.azureLogAnalytics), { dashboardTime: true }) }), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: () => { }, schema: FakeSchemaData.getLogAnalyticsFakeEngineSchema() }));
        expect(onChange).toBeCalledWith(expect.objectContaining({
            azureLogAnalytics: expect.objectContaining({
                timeColumn: 'TimeGenerated',
            }),
        }));
    }));
    it('should render the default value if no time columns exist', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        const query = createMockQuery();
        const onChange = jest.fn();
        render(React.createElement(TimeManagement, { query: Object.assign(Object.assign({}, query), { azureLogAnalytics: Object.assign(Object.assign({}, query.azureLogAnalytics), { dashboardTime: true, timeColumn: undefined }) }), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: () => { }, schema: FakeSchemaData.getLogAnalyticsFakeEngineSchema([
                {
                    id: 't/Alert',
                    name: 'Alert',
                    timespanColumn: 'TimeGenerated',
                    columns: [],
                    related: {
                        solutions: [],
                    },
                },
            ]) }));
        expect(onChange).toBeCalledWith(expect.objectContaining({
            azureLogAnalytics: expect.objectContaining({
                timeColumn: 'TimeGenerated',
            }),
        }));
    }));
    it('should render the first time column if no default exists', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        const query = createMockQuery();
        const onChange = jest.fn();
        render(React.createElement(TimeManagement, { query: Object.assign(Object.assign({}, query), { azureLogAnalytics: Object.assign(Object.assign({}, query.azureLogAnalytics), { dashboardTime: true, timeColumn: undefined }) }), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: () => { }, schema: FakeSchemaData.getLogAnalyticsFakeEngineSchema([
                {
                    id: 't/Alert',
                    name: 'Alert',
                    timespanColumn: '',
                    columns: [{ name: 'Timespan', type: 'datetime' }],
                    related: {
                        solutions: [],
                    },
                },
            ]) }));
        expect(onChange).toBeCalledWith(expect.objectContaining({
            azureLogAnalytics: expect.objectContaining({
                timeColumn: 'Timespan',
            }),
        }));
    }));
    it('should render the query time column if it exists', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        const query = createMockQuery();
        const onChange = jest.fn();
        render(React.createElement(TimeManagement, { query: Object.assign(Object.assign({}, query), { azureLogAnalytics: Object.assign(Object.assign({}, query.azureLogAnalytics), { dashboardTime: true, timeColumn: 'TestTimeColumn' }) }), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: () => { }, schema: FakeSchemaData.getLogAnalyticsFakeEngineSchema([
                {
                    id: 't/Alert',
                    name: 'Alert',
                    timespanColumn: '',
                    columns: [{ name: 'TestTimeColumn', type: 'datetime' }],
                    related: {
                        solutions: [],
                    },
                },
            ]) }));
        expect(onChange).not.toBeCalled();
        expect(screen.getByText('Alert > TestTimeColumn')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=TimeManagement.test.js.map
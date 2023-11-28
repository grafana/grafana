import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { createMockResourcePickerData } from '../MetricsQueryEditor/MetricsQueryEditor.test';
import LogsQueryEditor from './LogsQueryEditor';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        replace: (val) => {
            return val;
        },
    }) })));
const variableOptionGroup = {
    label: 'Template variables',
    options: [],
};
describe('LogsQueryEditor', () => {
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    beforeEach(() => {
        window.HTMLElement.prototype.scrollIntoView = function () { };
    });
    afterEach(() => {
        window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    });
    it('should select multiple resources', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_a = query === null || query === void 0 ? void 0 : query.azureLogAnalytics) === null || _a === void 0 ? true : delete _a.resources;
        const onChange = jest.fn();
        render(React.createElement(LogsQueryEditor, { query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const subscriptionButton = yield screen.findByRole('button', { name: 'Expand Primary Subscription' });
        yield userEvent.click(subscriptionButton);
        const resourceGroupButton = yield screen.findByRole('button', { name: 'Expand A Great Resource Group' });
        yield userEvent.click(resourceGroupButton);
        const checkbox = yield screen.findByLabelText('web-server');
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        const checkbox2 = yield screen.findByLabelText('db-server');
        yield userEvent.click(checkbox2);
        expect(checkbox2).toBeChecked();
        yield userEvent.click(yield screen.findByRole('button', { name: 'Apply' }));
        expect(onChange).toBeCalledWith(expect.objectContaining({
            azureLogAnalytics: expect.objectContaining({
                resources: [
                    '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/web-server',
                    '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/db-server',
                ],
            }),
        }));
    }));
    it('should disable other resource types when selecting multiple resources', () => __awaiter(void 0, void 0, void 0, function* () {
        var _b;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_b = query === null || query === void 0 ? void 0 : query.azureLogAnalytics) === null || _b === void 0 ? true : delete _b.resources;
        const onChange = jest.fn();
        render(React.createElement(LogsQueryEditor, { query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const subscriptionButton = yield screen.findByRole('button', { name: 'Expand Primary Subscription' });
        yield userEvent.click(subscriptionButton);
        const resourceGroupButton = yield screen.findByRole('button', { name: 'Expand A Great Resource Group' });
        yield userEvent.click(resourceGroupButton);
        const checkbox = yield screen.findByLabelText('web-server');
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        expect(yield screen.findByLabelText('web-server_DataDisk')).toBeDisabled();
    }));
    it('should show info about multiple selection', () => __awaiter(void 0, void 0, void 0, function* () {
        var _c;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_c = query === null || query === void 0 ? void 0 : query.azureLogAnalytics) === null || _c === void 0 ? true : delete _c.resources;
        const onChange = jest.fn();
        render(React.createElement(LogsQueryEditor, { query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const subscriptionButton = yield screen.findByRole('button', { name: 'Expand Primary Subscription' });
        yield userEvent.click(subscriptionButton);
        const resourceGroupButton = yield screen.findByRole('button', { name: 'Expand A Great Resource Group' });
        yield userEvent.click(resourceGroupButton);
        const checkbox = yield screen.findByLabelText('web-server');
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        expect(yield screen.findByText('You may only choose items of the same resource type.')).toBeInTheDocument();
    }));
    it('should call onApply with a new subscription uri when a user types it in the selection box', () => __awaiter(void 0, void 0, void 0, function* () {
        var _d;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_d = query === null || query === void 0 ? void 0 : query.azureLogAnalytics) === null || _d === void 0 ? true : delete _d.resources;
        const onChange = jest.fn();
        render(React.createElement(LogsQueryEditor, { query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const advancedSection = screen.getByText('Advanced');
        yield userEvent.click(advancedSection);
        const advancedInput = yield screen.findByTestId('input-advanced-resource-picker-1');
        yield userEvent.type(advancedInput, '/subscriptions/def-123');
        const applyButton = screen.getByRole('button', { name: 'Apply' });
        yield userEvent.click(applyButton);
        expect(onChange).toBeCalledWith(expect.objectContaining({
            azureLogAnalytics: expect.objectContaining({
                resources: ['/subscriptions/def-123'],
            }),
        }));
    }));
    it('should update the dashboardTime prop', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        const onChange = jest.fn();
        render(React.createElement(LogsQueryEditor, { query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const dashboardTimeOption = yield screen.findByLabelText('Dashboard');
        yield userEvent.click(dashboardTimeOption);
        expect(onChange).toBeCalledWith(expect.objectContaining({
            azureLogAnalytics: expect.objectContaining({
                dashboardTime: true,
            }),
        }));
    }));
});
//# sourceMappingURL=LogsQueryEditor.test.js.map
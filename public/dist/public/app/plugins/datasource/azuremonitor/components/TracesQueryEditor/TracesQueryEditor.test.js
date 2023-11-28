import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import { createMockResourcePickerData } from '../MetricsQueryEditor/MetricsQueryEditor.test';
import TracesQueryEditor from './TracesQueryEditor';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        replace: (val) => {
            return val;
        },
    }) })));
const variableOptionGroup = {
    label: 'Template variables',
    options: [],
};
describe('TracesQueryEditor', () => {
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
        (_a = query === null || query === void 0 ? void 0 : query.azureTraces) === null || _a === void 0 ? true : delete _a.resources;
        const onChange = jest.fn();
        render(React.createElement(TracesQueryEditor, { query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const subscriptionButton = yield screen.findByRole('button', { name: 'Expand Primary Subscription' });
        yield userEvent.click(subscriptionButton);
        const resourceGroupButton = yield screen.findByRole('button', { name: 'Expand A Great Resource Group' });
        yield userEvent.click(resourceGroupButton);
        const checkbox = yield screen.findByLabelText('app-insights-1');
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        const checkbox2 = yield screen.findByLabelText('app-insights-2');
        yield userEvent.click(checkbox2);
        expect(checkbox2).toBeChecked();
        yield userEvent.click(yield screen.findByRole('button', { name: 'Apply' }));
        expect(onChange).toBeCalledWith(expect.objectContaining({
            azureTraces: expect.objectContaining({
                resources: [
                    '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.insights/components/app-insights-1',
                    '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.insights/components/app-insights-2',
                ],
            }),
        }));
    }));
    it('should disable other resource types when selecting multiple resources', () => __awaiter(void 0, void 0, void 0, function* () {
        var _b;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_b = query === null || query === void 0 ? void 0 : query.azureTraces) === null || _b === void 0 ? true : delete _b.resources;
        const onChange = jest.fn();
        render(React.createElement(TracesQueryEditor, { query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const subscriptionButton = yield screen.findByRole('button', { name: 'Expand Primary Subscription' });
        yield userEvent.click(subscriptionButton);
        const resourceGroupButton = yield screen.findByRole('button', { name: 'Expand A Great Resource Group' });
        yield userEvent.click(resourceGroupButton);
        const checkbox = yield screen.findByLabelText('app-insights-1');
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        expect(yield screen.findByLabelText('web-server_DataDisk')).toBeDisabled();
    }));
    it('should show info about multiple selection', () => __awaiter(void 0, void 0, void 0, function* () {
        var _c;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_c = query === null || query === void 0 ? void 0 : query.azureTraces) === null || _c === void 0 ? true : delete _c.resources;
        const onChange = jest.fn();
        render(React.createElement(TracesQueryEditor, { query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const subscriptionButton = yield screen.findByRole('button', { name: 'Expand Primary Subscription' });
        yield userEvent.click(subscriptionButton);
        const resourceGroupButton = yield screen.findByRole('button', { name: 'Expand A Great Resource Group' });
        yield userEvent.click(resourceGroupButton);
        const checkbox = yield screen.findByLabelText('app-insights-1');
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        expect(yield screen.findByText('You may only choose items of the same resource type.')).toBeInTheDocument();
    }));
    it('should call onApply with a new subscription uri when a user types it in the selection box', () => __awaiter(void 0, void 0, void 0, function* () {
        var _d;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_d = query === null || query === void 0 ? void 0 : query.azureTraces) === null || _d === void 0 ? true : delete _d.resources;
        const onChange = jest.fn();
        render(React.createElement(TracesQueryEditor, { query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const advancedSection = screen.getByText('Advanced');
        yield userEvent.click(advancedSection);
        const advancedInput = yield screen.findByTestId('input-advanced-resource-picker-1');
        yield userEvent.type(advancedInput, '/subscriptions/def-123');
        const applyButton = screen.getByRole('button', { name: 'Apply' });
        yield userEvent.click(applyButton);
        expect(onChange).toBeCalledWith(expect.objectContaining({
            azureTraces: expect.objectContaining({
                resources: ['/subscriptions/def-123'],
            }),
        }));
    }));
});
//# sourceMappingURL=TracesQueryEditor.test.js.map
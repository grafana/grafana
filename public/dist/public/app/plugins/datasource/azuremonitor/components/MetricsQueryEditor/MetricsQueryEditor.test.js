import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import createMockDatasource from '../../__mocks__/datasource';
import { createMockInstanceSetttings } from '../../__mocks__/instanceSettings';
import createMockPanelData from '../../__mocks__/panelData';
import createMockQuery from '../../__mocks__/query';
import { createMockResourceGroupsBySubscription, createMockSubscriptions, mockResourcesByResourceGroup, } from '../../__mocks__/resourcePickerRows';
import { selectors } from '../../e2e/selectors';
import ResourcePickerData from '../../resourcePicker/resourcePickerData';
import MetricsQueryEditor from './MetricsQueryEditor';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        replace: (val) => {
            return val;
        },
    }) })));
const variableOptionGroup = {
    label: 'Template variables',
    options: [],
};
export function createMockResourcePickerData() {
    const mockDatasource = createMockDatasource();
    const mockResourcePicker = new ResourcePickerData(createMockInstanceSetttings(), mockDatasource.azureMonitorDatasource);
    mockResourcePicker.getSubscriptions = jest.fn().mockResolvedValue(createMockSubscriptions());
    mockResourcePicker.getResourceGroupsBySubscriptionId = jest
        .fn()
        .mockResolvedValue(createMockResourceGroupsBySubscription());
    mockResourcePicker.getResourcesForResourceGroup = jest.fn().mockResolvedValue(mockResourcesByResourceGroup());
    mockResourcePicker.getResourceURIFromWorkspace = jest.fn().mockReturnValue('');
    mockResourcePicker.getResourceURIDisplayProperties = jest.fn().mockResolvedValue({});
    return mockResourcePicker;
}
describe('MetricsQueryEditor', () => {
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const mockPanelData = createMockPanelData();
    beforeEach(() => {
        window.HTMLElement.prototype.scrollIntoView = function () { };
    });
    afterEach(() => {
        window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    });
    it('should render', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        render(React.createElement(MetricsQueryEditor, { data: mockPanelData, query: createMockQuery(), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: () => { }, setError: () => { } }));
        expect(yield screen.findByTestId(selectors.components.queryEditor.metricsQueryEditor.container.input)).toBeInTheDocument();
    }));
    it('should show the current resource in the ResourcePicker', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery({
            subscription: 'def-456',
            azureMonitor: {
                metricNamespace: 'Microsoft.Compute/virtualMachines',
                resources: [
                    {
                        resourceGroup: 'dev-3',
                        resourceName: 'web-server',
                    },
                ],
            },
        });
        const onChange = jest.fn();
        render(React.createElement(MetricsQueryEditor, { data: mockPanelData, query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'web-server' });
        expect(resourcePickerButton).toBeInTheDocument();
        yield userEvent.click(resourcePickerButton);
        yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
            const selection = yield screen.findAllByLabelText('web-server');
            expect(selection).toHaveLength(2);
        }));
    }));
    it('should change resource when a resource is selected in the ResourcePicker', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_a = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _a === void 0 ? true : delete _a.resources;
        (_b = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _b === void 0 ? true : delete _b.metricNamespace;
        const onChange = jest.fn();
        render(React.createElement(MetricsQueryEditor, { data: mockPanelData, query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        expect(resourcePickerButton).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Expand Primary Subscription' })).not.toBeInTheDocument();
        yield userEvent.click(resourcePickerButton);
        const subscriptionButton = yield screen.findByRole('button', { name: 'Expand Primary Subscription' });
        expect(subscriptionButton).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Expand A Great Resource Group' })).not.toBeInTheDocument();
        yield userEvent.click(subscriptionButton);
        const resourceGroupButton = yield screen.findByRole('button', { name: 'Expand A Great Resource Group' });
        expect(resourceGroupButton).toBeInTheDocument();
        expect(screen.queryByLabelText('web-server')).not.toBeInTheDocument();
        yield userEvent.click(resourceGroupButton);
        const checkbox = yield screen.findByLabelText('web-server');
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        yield userEvent.click(yield screen.findByRole('button', { name: 'Apply' }));
        expect(onChange).toBeCalledTimes(1);
        expect(onChange).toBeCalledWith(expect.objectContaining({
            subscription: 'def-456',
            azureMonitor: expect.objectContaining({
                metricNamespace: 'microsoft.compute/virtualmachines',
                resources: [
                    expect.objectContaining({
                        resourceGroup: 'dev-3',
                        resourceName: 'web-server',
                    }),
                ],
            }),
        }));
    }));
    it('should select multiple resources', () => __awaiter(void 0, void 0, void 0, function* () {
        var _c, _d;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_c = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _c === void 0 ? true : delete _c.resources;
        (_d = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _d === void 0 ? true : delete _d.metricNamespace;
        const onChange = jest.fn();
        render(React.createElement(MetricsQueryEditor, { data: mockPanelData, query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
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
        expect(onChange).toBeCalledTimes(1);
        expect(onChange).toBeCalledWith(expect.objectContaining({
            subscription: 'def-456',
            azureMonitor: expect.objectContaining({
                metricNamespace: 'microsoft.compute/virtualmachines',
                resources: [
                    expect.objectContaining({
                        resourceGroup: 'dev-3',
                        resourceName: 'web-server',
                    }),
                    expect.objectContaining({
                        resourceGroup: 'dev-3',
                        resourceName: 'db-server',
                    }),
                ],
            }),
        }));
    }));
    it('should disable other resource types when selecting multiple resources', () => __awaiter(void 0, void 0, void 0, function* () {
        var _e, _f;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_e = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _e === void 0 ? true : delete _e.resources;
        (_f = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _f === void 0 ? true : delete _f.metricNamespace;
        const onChange = jest.fn();
        render(React.createElement(MetricsQueryEditor, { data: mockPanelData, query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
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
        var _g, _h;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_g = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _g === void 0 ? true : delete _g.resources;
        (_h = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _h === void 0 ? true : delete _h.metricNamespace;
        const onChange = jest.fn();
        render(React.createElement(MetricsQueryEditor, { data: mockPanelData, query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const subscriptionButton = yield screen.findByRole('button', { name: 'Expand Primary Subscription' });
        yield userEvent.click(subscriptionButton);
        const resourceGroupButton = yield screen.findByRole('button', { name: 'Expand A Great Resource Group' });
        yield userEvent.click(resourceGroupButton);
        const checkbox = yield screen.findByLabelText('web-server');
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        expect(yield screen.findByText('You can select items of the same resource type and location. To select resources of a different resource type or location, please first uncheck your current selection.')).toBeInTheDocument();
    }));
    it('should change the metric name when selected', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const onChange = jest.fn();
        const mockQuery = createMockQuery();
        mockDatasource.azureMonitorDatasource.getMetricNames = jest.fn().mockResolvedValue([
            {
                value: 'metric-a',
                text: 'Metric A',
            },
            {
                value: 'metric-b',
                text: 'Metric B',
            },
        ]);
        render(React.createElement(MetricsQueryEditor, { data: mockPanelData, query: createMockQuery(), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const metrics = yield screen.findByLabelText('Metric');
        expect(metrics).toBeInTheDocument();
        yield selectOptionInTest(metrics, 'Metric B');
        expect(onChange).toHaveBeenLastCalledWith(Object.assign(Object.assign({}, mockQuery), { azureMonitor: Object.assign(Object.assign({}, mockQuery.azureMonitor), { metricName: 'metric-b', aggregation: undefined, timeGrain: '' }) }));
    }));
    it('should change the aggregation type when selected', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const onChange = jest.fn();
        const mockQuery = createMockQuery();
        render(React.createElement(MetricsQueryEditor, { data: mockPanelData, query: createMockQuery(), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const aggregation = yield screen.findByLabelText('Aggregation');
        expect(aggregation).toBeInTheDocument();
        yield selectOptionInTest(aggregation, 'Maximum');
        expect(onChange).toHaveBeenLastCalledWith(Object.assign(Object.assign({}, mockQuery), { azureMonitor: Object.assign(Object.assign({}, mockQuery.azureMonitor), { aggregation: 'Maximum' }) }));
    }));
    it('should show unselect a resource if the value is manually edited', () => __awaiter(void 0, void 0, void 0, function* () {
        var _j, _k;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_j = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _j === void 0 ? true : delete _j.resources;
        (_k = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _k === void 0 ? true : delete _k.metricNamespace;
        const onChange = jest.fn();
        render(React.createElement(MetricsQueryEditor, { data: mockPanelData, query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const subscriptionButton = yield screen.findByRole('button', { name: 'Expand Primary Subscription' });
        yield userEvent.click(subscriptionButton);
        const resourceGroupButton = yield screen.findByRole('button', { name: 'Expand A Great Resource Group' });
        yield userEvent.click(resourceGroupButton);
        const checkbox = yield screen.findByLabelText('web-server');
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        const advancedSection = screen.getByText('Advanced');
        yield userEvent.click(advancedSection);
        const advancedInput = yield screen.findByLabelText('Subscription');
        yield userEvent.type(advancedInput, 'def-123');
        const updatedCheckboxes = yield screen.findAllByLabelText('web-server');
        expect(updatedCheckboxes.length).toBe(2);
        // Unselect the one listed in the rows
        expect(updatedCheckboxes[0]).not.toBeChecked();
        // But the one in the advanced section should still be selected
        expect(updatedCheckboxes[1]).toBeChecked();
    }));
    it('should call onApply with a new subscription when a user types it in the selection box', () => __awaiter(void 0, void 0, void 0, function* () {
        var _l, _m;
        const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
        const query = createMockQuery();
        query === null || query === void 0 ? true : delete query.subscription;
        (_l = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _l === void 0 ? true : delete _l.resources;
        (_m = query === null || query === void 0 ? void 0 : query.azureMonitor) === null || _m === void 0 ? true : delete _m.metricNamespace;
        const onChange = jest.fn();
        render(React.createElement(MetricsQueryEditor, { data: mockPanelData, query: query, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: () => { } }));
        const resourcePickerButton = yield screen.findByRole('button', { name: 'Select a resource' });
        yield userEvent.click(resourcePickerButton);
        const advancedSection = screen.getByText('Advanced');
        yield userEvent.click(advancedSection);
        const advancedInput = yield screen.findByLabelText('Subscription');
        yield userEvent.type(advancedInput, 'def-123');
        const nsInput = yield screen.findByLabelText('Namespace');
        yield userEvent.type(nsInput, 'ns');
        const rgInput = yield screen.findByLabelText('Resource Group');
        yield userEvent.type(rgInput, 'rg');
        const rnInput = yield screen.findByLabelText('Resource Name');
        yield userEvent.type(rnInput, 'rn');
        const applyButton = screen.getByRole('button', { name: 'Apply' });
        yield userEvent.click(applyButton);
        expect(onChange).toBeCalledTimes(1);
        expect(onChange).toBeCalledWith(expect.objectContaining({
            azureMonitor: expect.objectContaining({
                resources: [{ subscription: 'def-123', metricNamespace: 'ns', resourceGroup: 'rg', resourceName: 'rn' }],
            }),
        }));
    }));
});
//# sourceMappingURL=MetricsQueryEditor.test.js.map
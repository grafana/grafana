import { __awaiter } from "tslib";
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { omit } from 'lodash';
import React from 'react';
import createMockDatasource from '../../__mocks__/datasource';
import { createMockInstanceSetttings } from '../../__mocks__/instanceSettings';
import { createMockResourceGroupsBySubscription, createMockSubscriptions, mockResourcesByResourceGroup, mockSearchResults, } from '../../__mocks__/resourcePickerRows';
import ResourcePickerData from '../../resourcePicker/resourcePickerData';
import { ResourceRowType } from './types';
import ResourcePicker from '.';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        replace: (val) => {
            return val;
        },
    }) })));
const noResourceURI = '';
const singleSubscriptionSelectionURI = '/subscriptions/def-456';
const singleResourceGroupSelectionURI = '/subscriptions/def-456/resourceGroups/dev-3';
const singleResourceSelectionURI = '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/db-server';
const noop = () => { };
function createMockResourcePickerData(preserveImplementation) {
    const mockDatasource = createMockDatasource();
    const mockResourcePicker = new ResourcePickerData(createMockInstanceSetttings(), mockDatasource.azureMonitorDatasource);
    const mockFunctions = omit({
        getSubscriptions: jest.fn().mockResolvedValue(createMockSubscriptions()),
        getResourceGroupsBySubscriptionId: jest.fn().mockResolvedValue(createMockResourceGroupsBySubscription()),
        getResourcesForResourceGroup: jest.fn().mockResolvedValue(mockResourcesByResourceGroup()),
        getResourceURIFromWorkspace: jest.fn().mockReturnValue(''),
        getResourceURIDisplayProperties: jest.fn().mockResolvedValue({}),
        search: jest.fn().mockResolvedValue(mockSearchResults()),
    }, preserveImplementation || []);
    return Object.assign(mockResourcePicker, mockFunctions);
}
const queryType = 'logs';
const defaultProps = {
    templateVariables: [],
    resources: [],
    resourcePickerData: createMockResourcePickerData(),
    onCancel: noop,
    onApply: noop,
    selectableEntryTypes: [
        ResourceRowType.Subscription,
        ResourceRowType.ResourceGroup,
        ResourceRowType.Resource,
        ResourceRowType.Variable,
    ],
    queryType,
    disableRow: jest.fn(),
    renderAdvanced: jest.fn(),
};
describe('AzureMonitor ResourcePicker', () => {
    beforeEach(() => {
        window.HTMLElement.prototype.scrollIntoView = jest.fn();
    });
    it('should pre-load subscriptions when there is no existing selection', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resources: [noResourceURI] })));
        const subscriptionCheckbox = yield screen.findByLabelText('Primary Subscription');
        expect(subscriptionCheckbox).toBeInTheDocument();
        expect(subscriptionCheckbox).not.toBeChecked();
        const uncheckedCheckboxes = yield screen.findAllByRole('checkbox', { checked: false });
        expect(uncheckedCheckboxes.length).toBe(3);
    }));
    it('should show a subscription as selected if there is one saved', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resources: [singleSubscriptionSelectionURI] })));
        yield waitFor(() => {
            expect(screen.getAllByLabelText('Dev Subscription')).toHaveLength(2);
        });
        const subscriptionCheckboxes = yield screen.findAllByLabelText('Dev Subscription');
        expect(subscriptionCheckboxes[0]).toBeChecked();
        expect(subscriptionCheckboxes[1]).toBeChecked();
    }));
    it('should show a resourceGroup as selected if there is one saved', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resources: [singleResourceGroupSelectionURI] })));
        yield waitFor(() => {
            expect(screen.getAllByLabelText('A Great Resource Group')).toHaveLength(2);
        });
        const resourceGroupCheckboxes = yield screen.findAllByLabelText('A Great Resource Group');
        expect(resourceGroupCheckboxes[0]).toBeChecked();
        expect(resourceGroupCheckboxes[1]).toBeChecked();
    }));
    it('should show scroll down to a resource and mark it as selected if there is one saved', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resources: [singleResourceSelectionURI] })));
        yield waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });
        yield waitFor(() => {
            expect(screen.getAllByLabelText('db-server')).toHaveLength(2);
        });
        const resourceCheckboxes = yield screen.findAllByLabelText('db-server');
        expect(resourceCheckboxes[0]).toBeChecked();
        expect(resourceCheckboxes[1]).toBeChecked();
    }));
    it('opens the selected nested resources', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resources: [singleResourceSelectionURI] })));
        const collapseSubscriptionBtn = yield screen.findByLabelText('Collapse Dev Subscription');
        expect(collapseSubscriptionBtn).toBeInTheDocument();
        const collapseResourceGroupBtn = yield screen.findByLabelText('Collapse A Great Resource Group');
        expect(collapseResourceGroupBtn).toBeInTheDocument();
    }));
    it('scrolls down to the selected resource', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resources: [singleResourceSelectionURI] })));
        yield screen.findByLabelText('Collapse A Great Resource Group');
        expect(window.HTMLElement.prototype.scrollIntoView).toBeCalledTimes(1);
    }));
    it('should be able to expand a subscription when clicked and reveal resource groups', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps)));
        const expandSubscriptionButton = yield screen.findByLabelText('Expand Primary Subscription');
        expect(expandSubscriptionButton).toBeInTheDocument();
        expect(screen.queryByLabelText('A Great Resource Group')).not.toBeInTheDocument();
        yield userEvent.click(expandSubscriptionButton);
        expect(yield screen.findByLabelText('A Great Resource Group')).toBeInTheDocument();
    }));
    it('should call onApply with a new subscription uri when a user clicks on the checkbox in the row', () => __awaiter(void 0, void 0, void 0, function* () {
        const onApply = jest.fn();
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { onApply: onApply })));
        const subscriptionCheckbox = yield screen.findByLabelText('Primary Subscription');
        expect(subscriptionCheckbox).toBeInTheDocument();
        expect(subscriptionCheckbox).not.toBeChecked();
        yield userEvent.click(subscriptionCheckbox);
        const applyButton = screen.getByRole('button', { name: 'Apply' });
        expect(applyButton).toBeEnabled();
        yield userEvent.click(applyButton);
        expect(onApply).toBeCalledTimes(1);
        expect(onApply).toBeCalledWith(['/subscriptions/def-123']);
    }));
    it('should call onApply removing an element', () => __awaiter(void 0, void 0, void 0, function* () {
        const onApply = jest.fn();
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resources: ['/subscriptions/def-123'], onApply: onApply })));
        yield waitFor(() => {
            expect(screen.getAllByLabelText('Primary Subscription')).toHaveLength(2);
        });
        const subscriptionCheckbox = yield screen.findAllByLabelText('Primary Subscription');
        expect(subscriptionCheckbox.at(0)).toBeChecked();
        yield userEvent.click(subscriptionCheckbox.at(0));
        const applyButton = screen.getByRole('button', { name: 'Apply' });
        yield userEvent.click(applyButton);
        expect(onApply).toBeCalledTimes(1);
        expect(onApply).toBeCalledWith([]);
    }));
    it('should call onApply removing an element ignoring the case', () => __awaiter(void 0, void 0, void 0, function* () {
        const onApply = jest.fn();
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resources: ['/subscriptions/def-456/resourceGroups/DEV-3'], onApply: onApply })));
        yield waitFor(() => {
            expect(screen.getAllByLabelText('A Great Resource Group')).toHaveLength(2);
        });
        const subscriptionCheckbox = yield screen.findAllByLabelText('A Great Resource Group');
        expect(subscriptionCheckbox.at(0)).toBeChecked();
        yield userEvent.click(subscriptionCheckbox.at(0));
        const applyButton = screen.getByRole('button', { name: 'Apply' });
        yield userEvent.click(applyButton);
        expect(onApply).toBeCalledTimes(1);
        expect(onApply).toBeCalledWith([]);
    }));
    it('should call onApply with a new resource when a user clicks on the checkbox in the row', () => __awaiter(void 0, void 0, void 0, function* () {
        const onApply = jest.fn();
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { queryType: 'metrics', onApply: onApply, resources: [] })));
        const subscriptionButton = yield screen.findByRole('button', { name: 'Expand Primary Subscription' });
        expect(subscriptionButton).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Expand A Great Resource Group' })).not.toBeInTheDocument();
        yield userEvent.click(subscriptionButton);
        const resourceGroupButton = yield screen.findByRole('button', { name: 'Expand A Great Resource Group' });
        yield userEvent.click(resourceGroupButton);
        const checkbox = yield screen.findByLabelText('web-server');
        yield userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        const applyButton = screen.getByRole('button', { name: 'Apply' });
        yield userEvent.click(applyButton);
        expect(onApply).toBeCalledTimes(1);
        expect(onApply).toBeCalledWith([
            {
                metricNamespace: 'Microsoft.Compute/virtualMachines',
                region: 'northeurope',
                resourceGroup: 'dev-3',
                resourceName: 'web-server',
                subscription: 'def-456',
            },
        ]);
    }));
    it('should call onApply removing a resource element', () => __awaiter(void 0, void 0, void 0, function* () {
        const onApply = jest.fn();
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { onApply: onApply, resources: [
                {
                    metricNamespace: 'Microsoft.Compute/virtualMachines',
                    region: 'northeurope',
                    resourceGroup: 'dev-3',
                    resourceName: 'web-server',
                    subscription: 'def-456',
                },
            ] })));
        yield waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });
        yield waitFor(() => {
            expect(screen.getAllByLabelText('web-server')).toHaveLength(2);
        });
        const checkbox = yield screen.findAllByLabelText('web-server');
        expect(checkbox.at(0)).toBeChecked();
        yield userEvent.click(checkbox.at(0));
        const applyButton = screen.getByRole('button', { name: 'Apply' });
        yield userEvent.click(applyButton);
        expect(onApply).toBeCalledTimes(1);
        expect(onApply).toBeCalledWith([]);
    }));
    it('renders a search field which show search results when there are results', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps)));
        const searchRow1 = screen.queryByLabelText('search-result');
        expect(searchRow1).not.toBeInTheDocument();
        const searchField = yield screen.findByLabelText('resource search');
        expect(searchField).toBeInTheDocument();
        yield userEvent.type(searchField, 'sea');
        const searchRow2 = yield screen.findByLabelText('search-result');
        expect(searchRow2).toBeInTheDocument();
    }));
    it('renders no results if there are no search results', () => __awaiter(void 0, void 0, void 0, function* () {
        const rpd = createMockResourcePickerData();
        rpd.search = jest.fn().mockResolvedValue([]);
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resourcePickerData: rpd })));
        const searchField = yield screen.findByLabelText('resource search');
        expect(searchField).toBeInTheDocument();
        yield userEvent.type(searchField, 'some search that has no results');
        const noResults = yield screen.findByText('No resources found');
        expect(noResults).toBeInTheDocument();
    }));
    it('renders a loading state while waiting for search results', () => __awaiter(void 0, void 0, void 0, function* () {
        const rpd = createMockResourcePickerData();
        let promiseResolver = () => { };
        const promiseToResolve = new Promise((resolve) => {
            promiseResolver = resolve;
        });
        rpd.search = jest.fn().mockImplementation(() => promiseToResolve);
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resourcePickerData: rpd })));
        const searchField = yield screen.findByLabelText('resource search');
        expect(searchField).toBeInTheDocument();
        yield userEvent.type(searchField, 'sear');
        const loading = yield screen.findByText('Loading...');
        expect(loading).toBeInTheDocument();
        // resolve the promise
        promiseResolver(mockSearchResults());
        const searchResult = yield screen.findByLabelText('search-result');
        expect(searchResult).toBeInTheDocument();
        const loadingAfterResults = screen.queryByText('Loading...');
        expect(loadingAfterResults).not.toBeInTheDocument();
    }));
    it('resets result when the user clears their search', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resources: [noResourceURI] })));
        const subscriptionCheckboxBeforeSearch = yield screen.findByLabelText('Primary Subscription');
        expect(subscriptionCheckboxBeforeSearch).toBeInTheDocument();
        const searchRow1 = screen.queryByLabelText('search-result');
        expect(searchRow1).not.toBeInTheDocument();
        const searchField = yield screen.findByLabelText('resource search');
        expect(searchField).toBeInTheDocument();
        yield userEvent.type(searchField, 'sea');
        const searchRow2 = yield screen.findByLabelText('search-result');
        expect(searchRow2).toBeInTheDocument();
        const subscriptionCheckboxAfterSearch = screen.queryByLabelText('Primary Subscription');
        expect(subscriptionCheckboxAfterSearch).not.toBeInTheDocument();
        yield userEvent.clear(searchField);
        const subscriptionCheckboxAfterClear = yield screen.findByLabelText('Primary Subscription');
        expect(subscriptionCheckboxAfterClear).toBeInTheDocument();
    }));
    it('should throw an error if no namespaces are found', () => __awaiter(void 0, void 0, void 0, function* () {
        const resourcePickerData = createMockResourcePickerData(['getResourceGroupsBySubscriptionId']);
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { queryType: 'metrics', resourcePickerData: resourcePickerData, resources: [noResourceURI] })));
        const subscriptionExpand = yield screen.findByLabelText('Expand Primary Subscription');
        yield userEvent.click(subscriptionExpand);
        const error = yield screen.findByRole('alert');
        expect(error).toHaveTextContent('An error occurred while requesting resources from Azure Monitor');
        expect(error).toHaveTextContent('Unable to resolve a list of valid metric namespaces. Validate the datasource configuration is correct and required permissions have been granted for all subscriptions. Grafana requires at least the Reader role to be assigned.');
    }));
    it('display a row for a selected resource even if it is not part of the current rows', () => __awaiter(void 0, void 0, void 0, function* () {
        const resourcePickerData = createMockResourcePickerData([]);
        resourcePickerData.fetchInitialRows = jest.fn().mockResolvedValue([]);
        render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { resources: [
                {
                    metricNamespace: 'Microsoft.Compute/virtualMachines',
                    region: 'northeurope',
                    resourceGroup: 'dev-3',
                    resourceName: 'web-server',
                    subscription: 'def-456',
                },
            ], resourcePickerData: resourcePickerData })));
        const checkbox = yield screen.findAllByLabelText('web-server');
        expect(checkbox).toHaveLength(1);
        expect(checkbox.at(0)).toBeChecked();
    }));
    describe('when rendering resource picker without any selectable entry types', () => {
        it('renders no checkboxes', () => __awaiter(void 0, void 0, void 0, function* () {
            yield act(() => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(ResourcePicker, Object.assign({}, defaultProps, { selectableEntryTypes: [] })));
            }));
            const checkboxes = screen.queryAllByRole('checkbox');
            expect(checkboxes.length).toBe(0);
        }));
    });
});
//# sourceMappingURL=ResourcePicker.test.js.map
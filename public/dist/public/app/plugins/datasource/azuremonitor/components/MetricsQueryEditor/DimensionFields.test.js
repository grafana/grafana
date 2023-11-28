import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { openMenu } from 'react-select-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import createMockDatasource from '../../__mocks__/datasource';
import createMockPanelData from '../../__mocks__/panelData';
import createMockQuery from '../../__mocks__/query';
import DimensionFields from './DimensionFields';
import { appendDimensionFilter, setDimensionFilterValue } from './setQueryValue';
const variableOptionGroup = {
    label: 'Template variables',
    options: [],
};
const user = userEvent.setup();
describe(`Azure Monitor QueryEditor`, () => {
    const mockDatasource = createMockDatasource();
    it('should render a dimension filter', () => __awaiter(void 0, void 0, void 0, function* () {
        let mockQuery = createMockQuery();
        const mockPanelData = createMockPanelData();
        const onQueryChange = jest.fn();
        const dimensionOptions = [
            { label: 'Test Dimension 1', value: 'TestDimension1' },
            { label: 'Test Dimension 2', value: 'TestDimension2' },
        ];
        const { rerender } = render(React.createElement(DimensionFields, { data: mockPanelData, subscriptionId: "123", query: mockQuery, onQueryChange: onQueryChange, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, setError: () => { }, dimensionOptions: dimensionOptions }));
        const addDimension = yield screen.findByLabelText('Add');
        yield user.click(addDimension);
        mockQuery = appendDimensionFilter(mockQuery);
        expect(onQueryChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, mockQuery), { azureMonitor: Object.assign(Object.assign({}, mockQuery.azureMonitor), { dimensionFilters: [{ dimension: '', operator: 'eq', filters: [] }] }) }));
        rerender(React.createElement(DimensionFields, { data: mockPanelData, subscriptionId: "123", query: mockQuery, onQueryChange: onQueryChange, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, setError: () => { }, dimensionOptions: dimensionOptions }));
        const dimensionSelect = yield screen.findByText('Field');
        yield selectOptionInTest(dimensionSelect, 'Test Dimension 1');
        expect(onQueryChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, mockQuery), { azureMonitor: Object.assign(Object.assign({}, mockQuery.azureMonitor), { dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: [] }] }) }));
        expect(screen.queryByText('Test Dimension 1')).toBeInTheDocument();
        expect(screen.queryByText('==')).toBeInTheDocument();
    }));
    it('correctly filters out dimensions when selected', () => __awaiter(void 0, void 0, void 0, function* () {
        let mockQuery = createMockQuery();
        const mockPanelData = createMockPanelData();
        mockQuery.azureMonitor = Object.assign(Object.assign({}, mockQuery.azureMonitor), { dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: [] }] });
        const onQueryChange = jest.fn();
        const dimensionOptions = [
            { label: 'Test Dimension 1', value: 'TestDimension1' },
            { label: 'Test Dimension 2', value: 'TestDimension2' },
        ];
        const { rerender } = render(React.createElement(DimensionFields, { data: mockPanelData, subscriptionId: "123", query: mockQuery, onQueryChange: onQueryChange, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, setError: () => { }, dimensionOptions: dimensionOptions }));
        const addDimension = yield screen.findByLabelText('Add');
        yield user.click(addDimension);
        mockQuery = appendDimensionFilter(mockQuery);
        rerender(React.createElement(DimensionFields, { data: mockPanelData, subscriptionId: "123", query: mockQuery, onQueryChange: onQueryChange, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, setError: () => { }, dimensionOptions: dimensionOptions }));
        const dimensionSelect = yield screen.findByText('Field');
        yield user.click(dimensionSelect);
        const options = yield screen.findAllByLabelText('Select option');
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent('Test Dimension 2');
    }));
    it('correctly displays dimension labels', () => __awaiter(void 0, void 0, void 0, function* () {
        let mockQuery = createMockQuery();
        const mockPanelData = createMockPanelData();
        mockQuery.azureMonitor = Object.assign(Object.assign({}, mockQuery.azureMonitor), { dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: [] }] });
        mockPanelData.series = [
            Object.assign(Object.assign({}, mockPanelData.series[0]), { fields: [
                    Object.assign(Object.assign({}, mockPanelData.series[0].fields[0]), { name: 'Test Dimension 1', labels: { Testdimension1: 'testlabel' } }),
                ] }),
        ];
        const onQueryChange = jest.fn();
        const dimensionOptions = [{ label: 'Test Dimension 1', value: 'TestDimension1' }];
        render(React.createElement(DimensionFields, { data: mockPanelData, subscriptionId: "123", query: mockQuery, onQueryChange: onQueryChange, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, setError: () => { }, dimensionOptions: dimensionOptions }));
        const labelSelect = yield screen.findByText('Select value(s)');
        yield user.click(labelSelect);
        const options = yield screen.findAllByLabelText('Select option');
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent('testlabel');
    }));
    it('correctly updates dimension labels', () => __awaiter(void 0, void 0, void 0, function* () {
        let mockQuery = createMockQuery();
        const mockPanelData = createMockPanelData();
        mockQuery.azureMonitor = Object.assign(Object.assign({}, mockQuery.azureMonitor), { dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: ['testlabel'] }] });
        mockPanelData.series = [
            Object.assign(Object.assign({}, mockPanelData.series[0]), { fields: [
                    Object.assign(Object.assign({}, mockPanelData.series[0].fields[0]), { name: 'Test Dimension 1', labels: { testdimension1: 'testlabel' } }),
                ] }),
        ];
        const onQueryChange = jest.fn();
        const dimensionOptions = [{ label: 'Test Dimension 1', value: 'TestDimension1' }];
        const { rerender } = render(React.createElement(DimensionFields, { data: mockPanelData, subscriptionId: "123", query: mockQuery, onQueryChange: onQueryChange, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, setError: () => { }, dimensionOptions: dimensionOptions }));
        yield screen.findByText('testlabel');
        const labelClear = yield screen.findAllByLabelText('Remove');
        yield user.click(labelClear[0]);
        mockQuery = setDimensionFilterValue(mockQuery, 0, 'filters', []);
        expect(onQueryChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, mockQuery), { azureMonitor: Object.assign(Object.assign({}, mockQuery.azureMonitor), { dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: [] }] }) }));
        mockPanelData.series = [
            ...mockPanelData.series,
            Object.assign(Object.assign({}, mockPanelData.series[0]), { fields: [
                    Object.assign(Object.assign({}, mockPanelData.series[0].fields[0]), { name: 'Test Dimension 1', labels: { testdimension1: 'testlabel2' } }),
                ] }),
        ];
        rerender(React.createElement(DimensionFields, { data: mockPanelData, subscriptionId: "123", query: mockQuery, onQueryChange: onQueryChange, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, setError: () => { }, dimensionOptions: dimensionOptions }));
        const labelSelect = screen.getByLabelText('dimension-labels-select');
        yield openMenu(labelSelect);
        const options = yield screen.findAllByLabelText('Select option');
        expect(options).toHaveLength(2);
        expect(options[0]).toHaveTextContent('testlabel');
        expect(options[1]).toHaveTextContent('testlabel2');
    }));
    it('correctly selects multiple dimension labels', () => __awaiter(void 0, void 0, void 0, function* () {
        let mockQuery = createMockQuery();
        const mockPanelData = createMockPanelData();
        mockPanelData.series = [
            Object.assign(Object.assign({}, mockPanelData.series[0]), { fields: [
                    Object.assign(Object.assign({}, mockPanelData.series[0].fields[0]), { name: 'Test Dimension 1', labels: { testdimension1: 'testlabel' } }),
                ] }),
            Object.assign(Object.assign({}, mockPanelData.series[0]), { fields: [
                    Object.assign(Object.assign({}, mockPanelData.series[0].fields[0]), { name: 'Test Dimension 1', labels: { testdimension1: 'testlabel2' } }),
                ] }),
        ];
        const onQueryChange = jest.fn();
        const dimensionOptions = [{ label: 'Test Dimension 1', value: 'TestDimension1' }];
        mockQuery = appendDimensionFilter(mockQuery, 'TestDimension1');
        const { rerender } = render(React.createElement(DimensionFields, { data: mockPanelData, subscriptionId: "123", query: mockQuery, onQueryChange: onQueryChange, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, setError: () => { }, dimensionOptions: dimensionOptions }));
        const labelSelect = screen.getByLabelText('dimension-labels-select');
        yield user.click(labelSelect);
        yield openMenu(labelSelect);
        screen.getByText('testlabel');
        screen.getByText('testlabel2');
        yield selectOptionInTest(labelSelect, 'testlabel');
        mockQuery = setDimensionFilterValue(mockQuery, 0, 'filters', ['testlabel']);
        expect(onQueryChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, mockQuery), { azureMonitor: Object.assign(Object.assign({}, mockQuery.azureMonitor), { dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: ['testlabel'] }] }) }));
        mockPanelData.series = [
            Object.assign(Object.assign({}, mockPanelData.series[0]), { fields: [
                    Object.assign(Object.assign({}, mockPanelData.series[0].fields[0]), { name: 'Test Dimension 1', labels: { testdimension1: 'testlabel' } }),
                ] }),
        ];
        rerender(React.createElement(DimensionFields, { data: mockPanelData, subscriptionId: "123", query: mockQuery, onQueryChange: onQueryChange, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, setError: () => { }, dimensionOptions: dimensionOptions }));
        const labelSelect2 = screen.getByLabelText('dimension-labels-select');
        yield openMenu(labelSelect2);
        const refreshedOptions = yield screen.findAllByLabelText('Select options menu');
        expect(refreshedOptions).toHaveLength(1);
        expect(refreshedOptions[0]).toHaveTextContent('testlabel2');
        yield selectOptionInTest(labelSelect2, 'testlabel2');
        mockQuery = setDimensionFilterValue(mockQuery, 0, 'filters', ['testlabel', 'testlabel2']);
        expect(onQueryChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, mockQuery), { azureMonitor: Object.assign(Object.assign({}, mockQuery.azureMonitor), { dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: ['testlabel', 'testlabel2'] }] }) }));
        mockPanelData.series = [
            Object.assign(Object.assign({}, mockPanelData.series[0]), { fields: [
                    Object.assign(Object.assign({}, mockPanelData.series[0].fields[0]), { name: 'Test Dimension 1', labels: { testdimension1: 'testlabel' } }),
                ] }),
            Object.assign(Object.assign({}, mockPanelData.series[0]), { fields: [
                    Object.assign(Object.assign({}, mockPanelData.series[0].fields[0]), { name: 'Test Dimension 1', labels: { testdimension1: 'testlabel2' } }),
                ] }),
        ];
    }));
});
//# sourceMappingURL=DimensionFields.test.js.map
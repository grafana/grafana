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

  it('should render a dimension filter', async () => {
    let mockQuery = createMockQuery();
    const mockPanelData = createMockPanelData();
    const onQueryChange = jest.fn();
    const dimensionOptions = [
      { label: 'Test Dimension 1', value: 'TestDimension1' },
      { label: 'Test Dimension 2', value: 'TestDimension2' },
    ];
    const { rerender } = render(
      <DimensionFields
        data={mockPanelData}
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={() => {}}
        dimensionOptions={dimensionOptions}
      />
    );

    const addDimension = await screen.findByLabelText('Add');
    await user.click(addDimension);

    mockQuery = appendDimensionFilter(mockQuery);
    expect(onQueryChange).toHaveBeenCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        dimensionFilters: [{ dimension: '', operator: 'eq', filters: [] }],
      },
    });
    rerender(
      <DimensionFields
        data={mockPanelData}
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={() => {}}
        dimensionOptions={dimensionOptions}
      />
    );
    const dimensionSelect = await screen.findByText('Field');
    await selectOptionInTest(dimensionSelect, 'Test Dimension 1');
    expect(onQueryChange).toHaveBeenCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: [] }],
      },
    });
    expect(screen.queryByText('Test Dimension 1')).toBeInTheDocument();
    expect(screen.queryByText('==')).toBeInTheDocument();
  });

  it('correctly filters out dimensions when selected', async () => {
    let mockQuery = createMockQuery();
    const mockPanelData = createMockPanelData();
    mockQuery.azureMonitor = {
      ...mockQuery.azureMonitor,
      dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: [] }],
    };
    const onQueryChange = jest.fn();
    const dimensionOptions = [
      { label: 'Test Dimension 1', value: 'TestDimension1' },
      { label: 'Test Dimension 2', value: 'TestDimension2' },
    ];
    const { rerender } = render(
      <DimensionFields
        data={mockPanelData}
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={() => {}}
        dimensionOptions={dimensionOptions}
      />
    );

    const addDimension = await screen.findByLabelText('Add');
    await user.click(addDimension);

    mockQuery = appendDimensionFilter(mockQuery);
    rerender(
      <DimensionFields
        data={mockPanelData}
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={() => {}}
        dimensionOptions={dimensionOptions}
      />
    );
    const dimensionSelect = await screen.findByText('Field');
    await user.click(dimensionSelect);
    const options = await screen.findAllByLabelText('Select option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Test Dimension 2');
  });

  it('correctly displays dimension labels', async () => {
    let mockQuery = createMockQuery();
    const mockPanelData = createMockPanelData();
    mockQuery.azureMonitor = {
      ...mockQuery.azureMonitor,
      dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: [] }],
    };

    mockPanelData.series = [
      {
        ...mockPanelData.series[0],
        fields: [
          {
            ...mockPanelData.series[0].fields[0],
            name: 'Test Dimension 1',
            labels: { Testdimension1: 'testlabel' },
          },
        ],
      },
    ];
    const onQueryChange = jest.fn();
    const dimensionOptions = [{ label: 'Test Dimension 1', value: 'TestDimension1' }];
    render(
      <DimensionFields
        data={mockPanelData}
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={() => {}}
        dimensionOptions={dimensionOptions}
      />
    );
    const labelSelect = await screen.findByText('Select value(s)');
    await user.click(labelSelect);
    const options = await screen.findAllByLabelText('Select option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('testlabel');
  });

  it('correctly updates dimension labels', async () => {
    let mockQuery = createMockQuery();
    const mockPanelData = createMockPanelData();
    mockQuery.azureMonitor = {
      ...mockQuery.azureMonitor,
      dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: ['testlabel'] }],
    };

    mockPanelData.series = [
      {
        ...mockPanelData.series[0],
        fields: [
          {
            ...mockPanelData.series[0].fields[0],
            name: 'Test Dimension 1',
            labels: { testdimension1: 'testlabel' },
          },
        ],
      },
    ];
    const onQueryChange = jest.fn();
    const dimensionOptions = [{ label: 'Test Dimension 1', value: 'TestDimension1' }];
    const { rerender } = render(
      <DimensionFields
        data={mockPanelData}
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={() => {}}
        dimensionOptions={dimensionOptions}
      />
    );
    await screen.findByText('testlabel');
    const labelClear = await screen.findAllByLabelText('Remove');
    await user.click(labelClear[0]);
    mockQuery = setDimensionFilterValue(mockQuery, 0, 'filters', []);
    expect(onQueryChange).toHaveBeenCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: [] }],
      },
    });
    mockPanelData.series = [
      ...mockPanelData.series,
      {
        ...mockPanelData.series[0],
        fields: [
          {
            ...mockPanelData.series[0].fields[0],
            name: 'Test Dimension 1',
            labels: { testdimension1: 'testlabel2' },
          },
        ],
      },
    ];
    rerender(
      <DimensionFields
        data={mockPanelData}
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={() => {}}
        dimensionOptions={dimensionOptions}
      />
    );
    const labelSelect = screen.getByLabelText('dimension-labels-select');
    await openMenu(labelSelect);
    const options = await screen.findAllByLabelText('Select option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('testlabel');
    expect(options[1]).toHaveTextContent('testlabel2');
  });

  it('correctly selects multiple dimension labels', async () => {
    let mockQuery = createMockQuery();
    const mockPanelData = createMockPanelData();
    mockPanelData.series = [
      {
        ...mockPanelData.series[0],
        fields: [
          {
            ...mockPanelData.series[0].fields[0],
            name: 'Test Dimension 1',
            labels: { testdimension1: 'testlabel' },
          },
        ],
      },
      {
        ...mockPanelData.series[0],
        fields: [
          {
            ...mockPanelData.series[0].fields[0],
            name: 'Test Dimension 1',
            labels: { testdimension1: 'testlabel2' },
          },
        ],
      },
    ];
    const onQueryChange = jest.fn();
    const dimensionOptions = [{ label: 'Test Dimension 1', value: 'TestDimension1' }];
    mockQuery = appendDimensionFilter(mockQuery, 'TestDimension1');
    const { rerender } = render(
      <DimensionFields
        data={mockPanelData}
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={() => {}}
        dimensionOptions={dimensionOptions}
      />
    );
    const labelSelect = screen.getByLabelText('dimension-labels-select');
    await user.click(labelSelect);
    await openMenu(labelSelect);
    screen.getByText('testlabel');
    screen.getByText('testlabel2');
    await selectOptionInTest(labelSelect, 'testlabel');
    mockQuery = setDimensionFilterValue(mockQuery, 0, 'filters', ['testlabel']);
    expect(onQueryChange).toHaveBeenCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: ['testlabel'] }],
      },
    });
    mockPanelData.series = [
      {
        ...mockPanelData.series[0],
        fields: [
          {
            ...mockPanelData.series[0].fields[0],
            name: 'Test Dimension 1',
            labels: { testdimension1: 'testlabel' },
          },
        ],
      },
    ];
    rerender(
      <DimensionFields
        data={mockPanelData}
        subscriptionId="123"
        query={mockQuery}
        onQueryChange={onQueryChange}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        setError={() => {}}
        dimensionOptions={dimensionOptions}
      />
    );
    const labelSelect2 = screen.getByLabelText('dimension-labels-select');
    await openMenu(labelSelect2);
    const refreshedOptions = await screen.findAllByLabelText('Select options menu');
    expect(refreshedOptions).toHaveLength(1);
    expect(refreshedOptions[0]).toHaveTextContent('testlabel2');
    await selectOptionInTest(labelSelect2, 'testlabel2');
    mockQuery = setDimensionFilterValue(mockQuery, 0, 'filters', ['testlabel', 'testlabel2']);
    expect(onQueryChange).toHaveBeenCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filters: ['testlabel', 'testlabel2'] }],
      },
    });
    mockPanelData.series = [
      {
        ...mockPanelData.series[0],
        fields: [
          {
            ...mockPanelData.series[0].fields[0],
            name: 'Test Dimension 1',
            labels: { testdimension1: 'testlabel' },
          },
        ],
      },
      {
        ...mockPanelData.series[0],
        fields: [
          {
            ...mockPanelData.series[0].fields[0],
            name: 'Test Dimension 1',
            labels: { testdimension1: 'testlabel2' },
          },
        ],
      },
    ];
  });
});

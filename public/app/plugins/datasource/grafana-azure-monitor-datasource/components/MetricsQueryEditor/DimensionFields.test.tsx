import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectOptionInTest } from '@grafana/ui';

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

describe('Azure Monitor QueryEditor', () => {
  const mockPanelData = createMockPanelData();
  const mockDatasource = createMockDatasource();

  it('should render a dimension filter', async () => {
    let mockQuery = createMockQuery();
    const onQueryChange = jest.fn();
    const dimensionOptions = [
      { label: 'Test Dimension 1', value: 'TestDimension1' },
      { label: 'Test Dimension 2', value: 'TestDimension2' },
    ];
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
    const addDimension = await screen.findByText('Add new dimension');
    await user.click(addDimension);
    mockQuery = appendDimensionFilter(mockQuery);
    expect(onQueryChange).toHaveBeenCalledWith({
      ...mockQuery,
      azureMonitor: { ...mockQuery.azureMonitor, dimensionFilters: [{ dimension: '', operator: 'eq', filter: '*' }] },
    });
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
    const dimensionSelect = await screen.findByText('Field');
    await selectOptionInTest(dimensionSelect, 'Test Dimension 1');
    expect(onQueryChange).toHaveBeenCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filter: '*' }],
      },
    });
    expect(screen.queryByText('Test Dimension 1')).toBeInTheDocument();
    expect(screen.queryByText('==')).toBeInTheDocument();
  });

  it('correctly filters out dimensions when selected', async () => {
    let mockQuery = createMockQuery();
    mockQuery.azureMonitor = {
      ...mockQuery.azureMonitor,
      dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filter: '*' }],
    };
    const onQueryChange = jest.fn();
    const dimensionOptions = [
      { label: 'Test Dimension 1', value: 'TestDimension1' },
      { label: 'Test Dimension 2', value: 'TestDimension2' },
    ];
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
    const addDimension = await screen.findByText('Add new dimension');
    await user.click(addDimension);
    mockQuery = appendDimensionFilter(mockQuery);
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
    const dimensionSelect = await screen.findByText('Field');
    await user.click(dimensionSelect);
    const options = await screen.findAllByLabelText('Select option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Test Dimension 2');
  });

  it('correctly displays dimension labels', async () => {
    let mockQuery = createMockQuery();
    mockQuery.azureMonitor = {
      ...mockQuery.azureMonitor,
      dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filter: '*' }],
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
    const labelSelect = await screen.findByText('Select value');
    await user.click(labelSelect);
    const options = await screen.findAllByLabelText('Select option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('testlabel');
  });

  it('correctly updates dimension labels', async () => {
    let mockQuery = createMockQuery();
    mockQuery.azureMonitor = {
      ...mockQuery.azureMonitor,
      dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filter: 'testlabel' }],
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
    await screen.findByText('testlabel');
    const labelClear = await screen.findByLabelText('select-clear-value');
    await user.click(labelClear);
    mockQuery = setDimensionFilterValue(mockQuery, 0, 'filter', '');
    expect(onQueryChange).toHaveBeenCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        dimensionFilters: [{ dimension: 'TestDimension1', operator: 'eq', filter: '' }],
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
    const labelSelect = await screen.findByText('Select value');
    await user.click(labelSelect);
    const options = await screen.findAllByLabelText('Select option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('testlabel');
    expect(options[1]).toHaveTextContent('testlabel2');
  });
});

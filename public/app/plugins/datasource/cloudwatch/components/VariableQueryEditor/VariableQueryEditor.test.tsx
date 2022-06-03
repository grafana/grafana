import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { select } from 'react-select-event';

import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import { VariableQueryType } from '../../types';

import { VariableQueryEditor, Props } from './VariableQueryEditor';

const defaultQuery = {
  queryType: VariableQueryType.Regions,
  namespace: '',
  region: '',
  metricName: '',
  dimensionKey: '',
  dimensionFilters: '',
  ec2Filters: '',
  instanceID: '',
  attributeName: '',
  resourceType: '',
  tags: '',
  refId: '',
};

const ds = setupMockedDataSource();

ds.datasource.getRegions = jest.fn().mockResolvedValue([
  { label: 'a1', value: 'a1' },
  { label: 'b1', value: 'b1' },
  { label: 'c1', value: 'c1' },
]);
ds.datasource.getNamespaces = jest.fn().mockResolvedValue([
  { label: 'x2', value: 'x2' },
  { label: 'y2', value: 'y2' },
  { label: 'z2', value: 'z2' },
]);
ds.datasource.getMetrics = jest.fn().mockResolvedValue([
  { label: 'h3', value: 'h3' },
  { label: 'i3', value: 'i3' },
  { label: 'j3', value: 'j3' },
]);
ds.datasource.getDimensionKeys = jest.fn().mockImplementation((namespace: string, region: string) => {
  if (region === 'a1') {
    return Promise.resolve([
      { label: 'q4', value: 'q4' },
      { label: 'r4', value: 'r4' },
      { label: 's4', value: 's4' },
    ]);
  }
  return Promise.resolve([{ label: 't4', value: 't4' }]);
});
ds.datasource.getVariables = jest.fn().mockReturnValue([]);

const defaultProps: Props = {
  onChange: jest.fn(),
  query: defaultQuery,
  datasource: ds.datasource,
  onRunQuery: () => {},
};

describe('VariableEditor', () => {
  describe('and a new variable is created', () => {
    it('should trigger a query using the first query type in the array', async () => {
      const props = defaultProps;
      props.query = defaultQuery;
      render(<VariableQueryEditor {...props} />);

      await waitFor(() => {
        const querySelect = screen.queryByRole('combobox', { name: 'Query type' });
        expect(querySelect).toBeInTheDocument();
        expect(screen.queryByText('Regions')).toBeInTheDocument();
        // Should not render any fields besides Query Type
        const regionSelect = screen.queryByRole('combobox', { name: 'Region' });
        expect(regionSelect).not.toBeInTheDocument();
      });
    });
  });

  describe('and an existing variable is edited', () => {
    it('should trigger new query using the saved query type', async () => {
      const props = defaultProps;
      props.query = {
        ...defaultQuery,
        queryType: VariableQueryType.Metrics,
        namespace: 'z2',
        region: 'a1',
      };
      render(<VariableQueryEditor {...props} />);

      await waitFor(() => {
        const querySelect = screen.queryByRole('combobox', { name: 'Query type' });
        expect(querySelect).toBeInTheDocument();
        expect(screen.queryByText('Metrics')).toBeInTheDocument();
        const regionSelect = screen.queryByRole('combobox', { name: 'Region' });
        expect(regionSelect).toBeInTheDocument();
        expect(screen.queryByText('a1')).toBeInTheDocument();
        const namespaceSelect = screen.queryByRole('combobox', { name: 'Namespace' });
        expect(namespaceSelect).toBeInTheDocument();
        expect(screen.queryByText('z2')).toBeInTheDocument();
        // Should only render Query Type, Region, and Namespace selectors
        const metricSelect = screen.queryByRole('combobox', { name: 'Metric' });
        expect(metricSelect).not.toBeInTheDocument();
      });
    });
  });
  describe('and a different region is selected', () => {
    it('should clear invalid fields', async () => {
      const props = defaultProps;
      props.query = {
        ...defaultQuery,
        queryType: VariableQueryType.DimensionValues,
        namespace: 'z2',
        region: 'a1',
        metricName: 'i3',
        dimensionKey: 's4',
      };
      render(<VariableQueryEditor {...props} />);

      const querySelect = screen.queryByLabelText('Query type');
      expect(querySelect).toBeInTheDocument();
      expect(screen.queryByText('Dimension Values')).toBeInTheDocument();
      const regionSelect = screen.getByRole('combobox', { name: 'Region' });
      regionSelect.click();
      await select(regionSelect, 'b1', {
        container: document.body,
      });

      expect(ds.datasource.getMetrics).toHaveBeenCalledWith('z2', 'b1');
      expect(ds.datasource.getDimensionKeys).toHaveBeenCalledWith('z2', 'b1');
      expect(props.onChange).toHaveBeenCalledWith({
        ...defaultQuery,
        refId: 'CloudWatchVariableQueryEditor-VariableQuery',
        queryType: VariableQueryType.DimensionValues,
        namespace: 'z2',
        region: 'b1',
        // metricName i3 exists in the new region and should not be removed
        metricName: 'i3',
        // dimensionKey s4 does not exist in the new region and should be removed
        dimensionKey: '',
      });
    });
  });
  describe('LogGroups queryType is selected', () => {
    it('should only render region and prefix', async () => {
      const props = defaultProps;
      props.query = {
        ...defaultQuery,
        queryType: VariableQueryType.LogGroups,
      };
      render(<VariableQueryEditor {...props} />);

      await waitFor(() => {
        screen.getByLabelText('Log group prefix');
      });
      screen.queryByRole('combobox', { name: 'Region' });

      expect(screen.queryByLabelText('Namespace')).not.toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { select } from 'react-select-event';
import { CloudWatchDatasource } from '../datasource';
import { VariableQuery, VariableQueryType } from '../types';
import VariableQueryEditor, { Props } from './VariableQueryEditor';

const defaultProps: Props = {
  onChange: jest.fn(),
  query: {} as unknown as VariableQuery,
  datasource: {
    getRegions: async () =>
      Promise.resolve([
        { label: 'a', value: 'a' },
        { label: 'b', value: 'b' },
        { label: 'c', value: 'c' },
      ]),
    getNamespaces: async () =>
      Promise.resolve([
        { label: 'x', value: 'x' },
        { label: 'y', value: 'y' },
        { label: 'z', value: 'z' },
      ]),
    getVariables: () => [],
    getMetrics: async (namespace: string) =>
      Promise.resolve([
        { label: 'h', value: 'h' },
        { label: 'i', value: 'i' },
        { label: 'j', value: 'j' },
      ]),
    getDimensionKeys: async (namespace: string, region: string) => {
      if (region === 'a') {
        return Promise.resolve([
          { label: 'q', value: 'q' },
          { label: 'r', value: 'r' },
          { label: 's', value: 's' },
        ]);
      }
      return Promise.resolve([{ label: 't', value: 't' }]);
    },
  } as unknown as CloudWatchDatasource,
  onRunQuery: () => {},
};

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

describe('VariableEditor', () => {
  describe('and a new variable is created', () => {
    it('should trigger a query using the first query type in the array', async () => {
      const props = defaultProps;
      props.query = defaultQuery;
      render(<VariableQueryEditor {...props} />);

      await waitFor(() => {
        const querySelect = screen.queryByRole('combobox', { name: 'Query Type' });
        expect(querySelect).toBeInTheDocument();
        expect(screen.queryByText('Regions')).toBeInTheDocument();
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
        namespace: 'z',
        region: 'a',
      };
      props.onChange = jest.fn();
      render(<VariableQueryEditor {...props} />);

      await waitFor(() => {
        const regionSelect = screen.queryByRole('combobox', { name: 'Region' });
        expect(regionSelect).toBeInTheDocument();
        const namespaceSelect = screen.queryByRole('combobox', { name: 'Namespace' });
        expect(namespaceSelect).toBeInTheDocument();
      });
    });
  });
  describe('and a different region is selected', () => {
    it('should clear invalid fields', async () => {
      const props = defaultProps;
      props.query = {
        ...defaultQuery,
        queryType: VariableQueryType.DimensionValues,
        namespace: 'z',
        region: 'a',
        metricName: 'i',
        dimensionKey: 's',
      };
      render(<VariableQueryEditor {...props} />);

      const querySelect = screen.queryByLabelText('Query Type');
      expect(querySelect).toBeInTheDocument();
      expect(screen.queryByText('Dimension Values')).toBeInTheDocument();
      const regionSelect = screen.getByRole('combobox', { name: 'Region' });
      regionSelect.click();
      await select(regionSelect, 'b', {
        container: document.body,
      });
      expect(props.onChange).toHaveBeenCalledWith({
        ...defaultQuery,
        refId: 'CloudWatchVariableQueryEditor-VariableQuery',
        queryType: VariableQueryType.DimensionValues,
        namespace: 'z',
        region: 'b',
        metricName: 'i',
        dimensionKey: '',
      });
    });
  });
});

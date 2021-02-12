import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import QueryEditor from './QueryEditor';
import Datasource from '../datasource';

import mockQuery from '../__mocks__/query';
import { AzureQueryType } from '../types';

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

function makeMockDatasource() {
  // We make this a partial so we get _some_ kind of time safety when making this, rather than
  // having it be any or casted immediately to Datasource
  const _mockDatasource: DeepPartial<Datasource> = {
    azureMonitorDatasource: {
      isConfigured() {
        return true;
      },
      getSubscriptions: jest.fn().mockResolvedValueOnce([]),
    },

    getResourceGroups: jest.fn().mockResolvedValueOnce([]),
    getMetricDefinitions: jest.fn().mockResolvedValueOnce([]),
    getResourceNames: jest.fn().mockResolvedValueOnce([]),
    getMetricNamespaces: jest.fn().mockResolvedValueOnce([]),
    getMetricNames: jest.fn().mockResolvedValueOnce([]),
    getMetricMetadata: jest.fn().mockResolvedValueOnce({
      primaryAggType: 'average',
      supportedAggTypes: [],
      supportedTimeGrains: [],
      dimensions: [],
    }),
  };

  const mockDatasource = _mockDatasource as Datasource;

  return mockDatasource;
}

describe('Azure Monitor QueryEditor', () => {
  it('renders the Metrics query editor when the query type is Metrics', async () => {
    const mockDatasource = makeMockDatasource();
    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());
  });

  it("does not render the Metrics query editor when the query type isn't Metrics", async () => {
    const mockDatasource = makeMockDatasource();
    const logsMockQuery = {
      ...mockQuery,
      queryType: AzureQueryType.LogAnalytics,
    };
    render(<QueryEditor query={logsMockQuery} datasource={mockDatasource} onChange={() => {}} />);
    await waitFor(() => expect(screen.queryByTestId('azure-monitor-metrics-query-editor')).not.toBeInTheDocument());
  });

  it('changes the query type when selected', async () => {
    const mockDatasource = makeMockDatasource();
    const onChange = jest.fn();
    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={onChange} />);
    // TODO: select "Logs" from the Query Type dropdown

    expect(onChange).toHaveBeenCalledWith({
      ...mockQuery,
      queryType: AzureQueryType.LogAnalytics,
    });
    // await waitFor(() => expect(screen.getByTestId('azure-monitor-query-editor')).toBeInTheDocument());
  });
});

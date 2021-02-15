import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import QueryEditor from './QueryEditor';

import mockQuery from '../__mocks__/query';
import createMockDatasource from '../__mocks__/datasource';
import { AzureQueryType } from '../types';

describe('Azure Monitor QueryEditor', () => {
  it('renders the Metrics query editor when the query type is Metrics', async () => {
    const mockDatasource = createMockDatasource();
    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());
  });

  it("does not render the Metrics query editor when the query type isn't Metrics", async () => {
    const mockDatasource = createMockDatasource();
    const logsMockQuery = {
      ...mockQuery,
      queryType: AzureQueryType.LogAnalytics,
    };
    render(<QueryEditor query={logsMockQuery} datasource={mockDatasource} onChange={() => {}} />);
    await waitFor(() => expect(screen.queryByTestId('azure-monitor-metrics-query-editor')).not.toBeInTheDocument());
  });

  it('changes the query type when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={onChange} />);
    await waitFor(() => expect(screen.getByTestId('azure-monitor-query-editor')).toBeInTheDocument());

    // Click the dropdown, then select "Logs"
    userEvent.click(screen.getByText('Metrics'));
    userEvent.click(screen.getByText('Logs'));

    expect(onChange).toHaveBeenCalledWith({
      ...mockQuery,
      queryType: AzureQueryType.LogAnalytics,
    });
  });
});

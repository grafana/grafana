import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import selectEvent from 'react-select-event';

import QueryEditor from './QueryEditor';

import createMockQuery from '../../__mocks__/query';
import createMockDatasource from '../../__mocks__/datasource';
import { AzureQueryType } from '../../types';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('Azure Monitor QueryEditor', () => {
  it('renders the Metrics query editor when the query type is Metrics', async () => {
    const mockDatasource = createMockDatasource();
    render(
      <QueryEditor
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());
  });

  it("does not render the Metrics query editor when the query type isn't Metrics", async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = createMockQuery();
    const logsMockQuery = {
      ...mockQuery,
      queryType: AzureQueryType.LogAnalytics,
    };
    render(
      <QueryEditor
        query={logsMockQuery}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
      />
    );
    await waitFor(() => expect(screen.queryByTestId('azure-monitor-metrics-query-editor')).not.toBeInTheDocument());
  });

  it('changes the query type when selected', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = createMockQuery();
    const onChange = jest.fn();
    render(
      <QueryEditor
        query={mockQuery}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
      />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-query-editor')).toBeInTheDocument());

    const metrics = await screen.findByLabelText('Service');
    await selectEvent.select(metrics, 'Logs');

    expect(onChange).toHaveBeenCalledWith({
      ...mockQuery,
      queryType: AzureQueryType.LogAnalytics,
    });
  });
});

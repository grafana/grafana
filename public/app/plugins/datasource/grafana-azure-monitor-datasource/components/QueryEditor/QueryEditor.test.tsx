import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import selectEvent from 'react-select-event';

import QueryEditor from './QueryEditor';

import createMockQuery from '../../__mocks__/query';
import createMockDatasource from '../../__mocks__/datasource';
import { AzureQueryType } from '../../types';
import { invalidNamespaceError } from '../../__mocks__/errors';
import * as ui from '@grafana/ui';

// Have to mock CodeEditor because it doesnt seem to work in tests???
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual<typeof ui>('@grafana/ui'),
  CodeEditor: function CodeEditor({ value }: { value: string }) {
    return <pre>{value}</pre>;
  },
}));

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('Azure Monitor QueryEditor', () => {
  it('renders the Metrics query editor when the query type is Metrics', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureMonitor,
    };

    render(
      <QueryEditor
        query={mockQuery}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());
  });

  it('renders the Logs query editor when the query type is Logs', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
    };

    render(
      <QueryEditor
        query={mockQuery}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
      />
    );
    await waitFor(() => expect(screen.queryByTestId('azure-monitor-logs-query-editor')).toBeInTheDocument());
  });

  it('renders the ApplicationInsights query editor when the query type is Application Insights and renders values in disabled inputs', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.ApplicationInsights,
      appInsights: {
        metricName: 'requests/count',
        timeGrain: 'PT1H',
        timeGrainCount: '1',
        timeGrainType: 'specific',
        timeGrainUnit: 'hour',
        aggregation: 'average',
        dimension: ['request/name'],
        dimensionFilter: "request/name eq 'GET Home/Index'",
        alias: '{{ request/name }}',
      },
    };

    render(
      <QueryEditor
        query={mockQuery}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
      />
    );
    await waitFor(() =>
      expect(screen.queryByTestId('azure-monitor-application-insights-query-editor')).toBeInTheDocument()
    );

    const metricInput = await screen.getByLabelText('Metric');
    expect(metricInput).toBeDisabled();
    expect(metricInput).toHaveValue('requests/count');
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
    await selectEvent.select(metrics, 'Logs', { container: document.body });

    expect(onChange).toHaveBeenCalledWith({
      ...mockQuery,
      queryType: AzureQueryType.LogAnalytics,
    });
  });

  it('displays error messages from frontend Azure calls', async () => {
    const mockDatasource = createMockDatasource();
    mockDatasource.azureMonitorDatasource.getSubscriptions = jest.fn().mockRejectedValue(invalidNamespaceError());
    render(
      <QueryEditor
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-query-editor')).toBeInTheDocument());

    expect(screen.getByText("The resource namespace 'grafanadev' is invalid.")).toBeInTheDocument();
  });

  it('hides deprecated services', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureMonitor,
    };

    render(
      <QueryEditor
        query={mockQuery}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());

    const metrics = await screen.findByLabelText('Service');
    selectEvent.openMenu(metrics);

    expect(screen.queryByText('Application Insights')).not.toBeInTheDocument();
  });

  it("shows deprecated services when they're selected", async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.ApplicationInsights,
    };

    render(
      <QueryEditor
        query={mockQuery}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId('azure-monitor-application-insights-query-editor')).toBeInTheDocument()
    );

    expect(screen.queryByText('Application Insights')).toBeInTheDocument();

    const metrics = await screen.findByLabelText('Service');
    await selectEvent.select(metrics, 'Logs', { container: document.body });

    expect(screen.queryByText('Application Insights')).toBeInTheDocument();
  });
});

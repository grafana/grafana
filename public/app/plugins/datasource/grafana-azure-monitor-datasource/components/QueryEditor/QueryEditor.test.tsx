import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';

import { config } from '@grafana/runtime';
import * as ui from '@grafana/ui';

import createMockDatasource from '../../__mocks__/datasource';
import { invalidNamespaceError } from '../../__mocks__/errors';
import createMockQuery from '../../__mocks__/query';
import { AzureQueryType, DeprecatedAzureQueryType } from '../../types';

import QueryEditor from './QueryEditor';

// Have to mock CodeEditor because it doesnt seem to work in tests???
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual<typeof ui>('@grafana/ui'),
  CodeEditor: function CodeEditor({ value }: { value: string }) {
    return <pre>{value}</pre>;
  },
}));

describe('Azure Monitor QueryEditor', () => {
  it('renders the Metrics query editor when the query type is Metrics', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureMonitor,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());
  });

  it('renders the Logs query editor when the query type is Logs', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.LogAnalytics,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() => expect(screen.queryByTestId('azure-monitor-logs-query-editor')).toBeInTheDocument());
  });

  it('renders the ApplicationInsights query editor when the query type is Application Insights and renders values in disabled inputs', async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: DeprecatedAzureQueryType.ApplicationInsights,
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

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
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
    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={onChange} onRunQuery={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('azure-monitor-query-editor')).toBeInTheDocument());

    const metrics = await screen.findByLabelText('Service');
    await ui.selectOptionInTest(metrics, 'Logs');

    expect(onChange).toHaveBeenCalledWith({
      ...mockQuery,
      queryType: AzureQueryType.LogAnalytics,
    });
  });

  it('displays error messages from frontend Azure calls', async () => {
    const mockDatasource = createMockDatasource();
    mockDatasource.azureMonitorDatasource.getSubscriptions = jest.fn().mockRejectedValue(invalidNamespaceError());
    render(
      <QueryEditor query={createMockQuery()} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />
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

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());

    const metrics = await screen.findByLabelText('Service');
    selectEvent.openMenu(metrics);

    expect(screen.queryByText('Application Insights')).not.toBeInTheDocument();
  });

  it("shows deprecated services when they're selected", async () => {
    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: DeprecatedAzureQueryType.ApplicationInsights,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);
    await waitFor(() =>
      expect(screen.getByTestId('azure-monitor-application-insights-query-editor')).toBeInTheDocument()
    );

    expect(screen.queryByText('Application Insights')).toBeInTheDocument();

    const metrics = await screen.findByLabelText('Service');
    await ui.selectOptionInTest(metrics, 'Logs');

    expect(screen.queryByText('Application Insights')).toBeInTheDocument();
  });

  it('renders the new query editor for metrics when enabled with a feature toggle', async () => {
    const originalConfigValue = config.featureToggles.azureMonitorResourcePickerForMetrics;

    // To do this irl go to custom.ini file and add resourcePickerForMetrics = true under [feature_toggles]
    config.featureToggles.azureMonitorResourcePickerForMetrics = true;

    const mockDatasource = createMockDatasource();
    const mockQuery = {
      ...createMockQuery(),
      queryType: AzureQueryType.AzureMonitor,
    };

    render(<QueryEditor query={mockQuery} datasource={mockDatasource} onChange={() => {}} onRunQuery={() => {}} />);

    await waitFor(() =>
      expect(screen.getByTestId('azure-monitor-metrics-query-editor-with-resource-picker')).toBeInTheDocument()
    );

    // reset config to not impact future tests
    config.featureToggles.azureMonitorResourcePickerForMetrics = originalConfigValue;
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import selectEvent from 'react-select-event';

import { config } from '@grafana/runtime';

import { setupMockedDataSource } from '../../../../__mocks__/CloudWatchDataSource';
import { createArray, createGroupBy } from '../../../../__mocks__/sqlUtils';
import { CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType, SQLExpression } from '../../../../types';

import SQLGroupBy from './SQLGroupBy';

const { datasource } = setupMockedDataSource();

const makeSQLQuery = (sql?: SQLExpression): CloudWatchMetricsQuery => ({
  queryMode: 'Metrics',
  refId: '',
  id: '',
  region: 'us-east-1',
  namespace: 'ec2',
  dimensions: { somekey: 'somevalue' },
  metricQueryType: MetricQueryType.Insights,
  metricEditorMode: MetricEditorMode.Builder,
  sql: sql,
});

datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);

describe('Cloudwatch SQLGroupBy', () => {
  afterEach(() => {
    baseProps.datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
  });

  const baseProps = {
    query: makeSQLQuery(),
    datasource,
    onQueryChange: () => {},
  };

  it('should load dimension keys with an empty dimension filter in case no group bys exist', async () => {
    const query = makeSQLQuery({
      groupBy: undefined,
    });

    render(<SQLGroupBy {...baseProps} query={query} />);
    await waitFor(() => {
      expect(screen.queryByText('InstanceId')).not.toBeInTheDocument();
      expect(screen.queryByText('InstanceType')).not.toBeInTheDocument();
    });
  });

  it('should load dimension keys with a dimension filter in case a group bys exist', async () => {
    const query = makeSQLQuery({
      groupBy: createArray([createGroupBy('InstanceId'), createGroupBy('InstanceType')]),
    });

    render(<SQLGroupBy {...baseProps} query={query} />);
    await waitFor(() => {
      expect(screen.getByText('InstanceId')).toBeInTheDocument();
      expect(screen.getByText('InstanceType')).toBeInTheDocument();
    });
  });

  it('should show Account ID in groupBy options if feature flag is enabled', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    config.featureToggles.cloudwatchMetricInsightsCrossAccount = true;
    baseProps.datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(true);
    const query = makeSQLQuery();

    render(<SQLGroupBy {...baseProps} query={query} />);
    const addButton = screen.getByRole('button', { name: 'Add' });
    await userEvent.click(addButton);
    selectEvent.openMenu(screen.getByLabelText(/Group by/));
    expect(screen.getByText('Account ID')).toBeInTheDocument();
  });

  it('should not show Account ID in groupBy options if not using a monitoring account', async () => {
    config.featureToggles.cloudWatchCrossAccountQuerying = true;
    config.featureToggles.cloudwatchMetricInsightsCrossAccount = true;
    baseProps.datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);

    const query = makeSQLQuery();

    render(<SQLGroupBy {...baseProps} query={query} />);
    const addButton = screen.getByRole('button', { name: 'Add' });
    await userEvent.click(addButton);
    selectEvent.openMenu(screen.getByLabelText(/Group by/));
    expect(screen.queryByText('Account ID')).not.toBeInTheDocument();
  });

  it('should not show Account ID in groupBy options if feature flag is disabled', async () => {
    config.featureToggles.cloudwatchMetricInsightsCrossAccount = false;
    const query = makeSQLQuery();

    render(<SQLGroupBy {...baseProps} query={query} />);
    const addButton = screen.getByRole('button', { name: 'Add' });
    await userEvent.click(addButton);
    selectEvent.openMenu(screen.getByLabelText(/Group by/));
    expect(screen.queryByText('Account ID')).not.toBeInTheDocument();
  });

  it('should allow adding a new dimension filter', async () => {
    const query = makeSQLQuery({
      groupBy: undefined,
    });
    render(<SQLGroupBy {...baseProps} query={query} />);

    expect(screen.queryByText('Choose')).not.toBeInTheDocument();
    expect(screen.queryByText('Template Variables')).not.toBeInTheDocument();

    const addButton = screen.getByRole('button', { name: 'Add' });
    expect(addButton).toBeInTheDocument();
    await userEvent.click(addButton);

    expect(screen.getByText('Choose')).toBeInTheDocument();

    selectEvent.openMenu(screen.getByLabelText(/Group by/));
    expect(screen.getByText('Template Variables')).toBeInTheDocument();
  });

  it('should allow removing a dimension filter', async () => {
    const query = makeSQLQuery({
      groupBy: createArray([createGroupBy('InstanceId')]),
    });
    render(<SQLGroupBy {...baseProps} query={query} />);

    expect(screen.getByText('InstanceId')).toBeInTheDocument();

    const removeButton = screen.getByRole('button', { name: 'remove' });
    expect(removeButton).toBeInTheDocument();
    await userEvent.click(removeButton);

    expect(screen.queryByText('InstanceId')).not.toBeInTheDocument();
  });
});

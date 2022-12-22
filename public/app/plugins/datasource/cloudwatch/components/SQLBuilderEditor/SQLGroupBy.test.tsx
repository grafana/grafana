import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';

import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import { createArray, createGroupBy } from '../../__mocks__/sqlUtils';
import { CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType, SQLExpression } from '../../types';

import SQLGroupBy from './SQLGroupBy';

const { datasource } = setupMockedDataSource();

const makeSQLQuery = (sql?: SQLExpression): CloudWatchMetricsQuery => ({
  queryMode: 'Metrics',
  refId: '',
  id: '',
  region: 'us-east-1',
  namespace: 'ec2',
  dimensions: { somekey: 'somevalue' },
  metricQueryType: MetricQueryType.Query,
  metricEditorMode: MetricEditorMode.Builder,
  sql: sql,
});

datasource.api.getDimensionKeys = jest.fn().mockResolvedValue([]);

describe('Cloudwatch SQLGroupBy', () => {
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

  it('should allow adding a new dimension filter', async () => {
    const query = makeSQLQuery({
      groupBy: undefined,
    });
    render(<SQLGroupBy {...baseProps} query={query} />);

    expect(screen.queryByText('Choose')).not.toBeInTheDocument();
    expect(screen.queryByText('Template Variables')).not.toBeInTheDocument();

    const addButton = screen.getByRole('button', { name: 'Add' });
    expect(addButton).toBeInTheDocument();
    addButton.click();

    expect(await screen.findByText('Choose')).toBeInTheDocument();

    selectEvent.openMenu(screen.getByLabelText(/Group by/));
    expect(await screen.findByText('Template Variables')).toBeInTheDocument();
  });

  it('should allow removing a dimension filter', async () => {
    const query = makeSQLQuery({
      groupBy: createArray([createGroupBy('InstanceId')]),
    });
    render(<SQLGroupBy {...baseProps} query={query} />);

    expect(screen.getByText('InstanceId')).toBeInTheDocument();

    const removeButton = screen.getByRole('button', { name: 'remove' });
    expect(removeButton).toBeInTheDocument();
    removeButton.click();

    await waitFor(() => {
      expect(screen.queryByText('InstanceId')).not.toBeInTheDocument();
    });
  });
});

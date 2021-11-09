import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType, SQLExpression } from '../../types';
import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import { createArray, createGroupBy } from '../../__mocks__/sqlUtils';
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
    act(async () => {
      await waitFor(() =>
        expect(datasource.getDimensionKeys).toHaveBeenCalledWith(query.namespace, query.region, {}, undefined)
      );
    });
  });
  it('should load dimension keys with a dimension filter in case a group bys exist', async () => {
    const query = makeSQLQuery({
      groupBy: createArray([createGroupBy('InstanceId'), createGroupBy('InstanceType')]),
    });

    render(<SQLGroupBy {...baseProps} query={query} />);
    act(async () => {
      expect(screen.getByText('InstanceId')).toBeInTheDocument();
      expect(screen.getByText('InstanceType')).toBeInTheDocument();

      await waitFor(() =>
        expect(datasource.getDimensionKeys).toHaveBeenCalledWith(
          query.namespace,
          query.region,
          { InstanceId: null, InstanceType: null },
          undefined
        )
      );
    });
  });
});

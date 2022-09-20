import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import { CloudWatchLogsQuery, CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType } from '../types';

import QueryHeader from './QueryHeader';

const ds = setupMockedDataSource({
  variables: [],
});
ds.datasource.api.getRegions = jest.fn().mockResolvedValue([]);

describe('QueryHeader', () => {
  it('should display metric options for metrics', async () => {
    const query: CloudWatchMetricsQuery = {
      queryMode: 'Metrics',
      id: '',
      region: 'us-east-2',
      namespace: '',
      period: '',
      alias: '',
      metricName: '',
      dimensions: {},
      matchExact: true,
      statistic: '',
      expression: '',
      refId: '',
    };
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    query.metricEditorMode = MetricEditorMode.Code;
    query.metricQueryType = MetricQueryType.Query;

    render(
      <QueryHeader
        sqlCodeEditorIsDirty={true}
        datasource={ds.datasource}
        query={query}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    const builderElement = screen.getByLabelText('Builder');
    expect(builderElement).toBeInTheDocument();
    await act(async () => {
      await builderElement.click();
    });

    const modalTitleElem = screen.getByText('Are you sure?');
    expect(modalTitleElem).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should not display metric options for logs', async () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const query: CloudWatchLogsQuery = {
      queryType: 'Metrics',
      id: '',
      region: 'us-east-2',
      expression: '',
      refId: '',
      queryMode: 'Logs',
    };

    render(
      <QueryHeader
        sqlCodeEditorIsDirty={true}
        datasource={ds.datasource}
        query={query}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    await waitFor(() => {
      expect(screen.queryByLabelText('Builder')).toBeNull();
      expect(screen.queryByLabelText('Code')).toBeNull();
    });
  });
});

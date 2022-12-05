import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';

import { config } from '@grafana/runtime';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import { validLogsQuery, validMetricSearchBuilderQuery } from '../__mocks__/queries';
import { CloudWatchLogsQuery, CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType } from '../types';

import QueryHeader from './QueryHeader';

const originalFeatureToggleValue = config.featureToggles.cloudWatchCrossAccountQuerying;
const ds = setupMockedDataSource({
  variables: [],
});
ds.datasource.api.getRegions = jest.fn().mockResolvedValue([]);

describe('QueryHeader', () => {
  afterEach(() => {
    config.featureToggles.cloudWatchCrossAccountQuerying = originalFeatureToggleValue;
  });
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

  describe('when changing region', () => {
    const { datasource } = setupMockedDataSource();
    datasource.api.getRegions = jest.fn().mockResolvedValue([
      { value: 'us-east-2', label: 'us-east-2' },
      { value: 'us-east-1', label: 'us-east-1' },
    ]);
    it('should reset account id if new region is not monitoring account', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const onChange = jest.fn();
      datasource.api.isMonitoringAccount = jest.fn().mockResolvedValue(false);
      render(
        <QueryHeader
          sqlCodeEditorIsDirty={true}
          datasource={datasource}
          query={{ ...validMetricSearchBuilderQuery, region: 'us-east-1', accountId: 'all' }}
          onChange={onChange}
          onRunQuery={jest.fn()}
        />
      );
      await waitFor(() => expect(screen.queryByText('us-east-1')).toBeInTheDocument());
      await act(async () => {
        await selectEvent.select(screen.getByLabelText(/Region/), 'us-east-2', { container: document.body });
      });
      expect(onChange).toHaveBeenCalledWith({
        ...validMetricSearchBuilderQuery,
        region: 'us-east-2',
        accountId: undefined,
      });
    });

    it('should not reset account id if new region is a monitoring account', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const onChange = jest.fn();
      datasource.api.isMonitoringAccount = jest.fn().mockResolvedValue(true);

      render(
        <QueryHeader
          sqlCodeEditorIsDirty={true}
          datasource={datasource}
          query={{ ...validMetricSearchBuilderQuery, region: 'us-east-1', accountId: '123' }}
          onChange={onChange}
          onRunQuery={jest.fn()}
        />
      );
      await waitFor(() => expect(screen.queryByText('us-east-1')).toBeInTheDocument());
      await act(async () => {
        await selectEvent.select(screen.getByLabelText(/Region/), 'us-east-2', { container: document.body });
      });
      expect(onChange).toHaveBeenCalledWith({
        ...validMetricSearchBuilderQuery,
        region: 'us-east-2',
        accountId: '123',
      });
    });

    it('should not call isMonitoringAccount if its a logs query', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const onChange = jest.fn();
      datasource.api.isMonitoringAccount = jest.fn().mockResolvedValue(true);

      render(
        <QueryHeader
          sqlCodeEditorIsDirty={true}
          datasource={datasource}
          query={{ ...validLogsQuery, region: 'us-east-1' }}
          onChange={onChange}
          onRunQuery={jest.fn()}
        />
      );
      await waitFor(() => expect(screen.queryByText('us-east-1')).toBeInTheDocument());
      await act(async () => {
        await selectEvent.select(screen.getByLabelText(/Region/), 'us-east-2', { container: document.body });
      });
      expect(datasource.api.isMonitoringAccount).not.toHaveBeenCalledWith('us-east-2');
    });

    it('should not call isMonitoringAccount if feature toggle is not enabled', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = false;
      const onChange = jest.fn();
      datasource.api.isMonitoringAccount = jest.fn();

      render(
        <QueryHeader
          sqlCodeEditorIsDirty={true}
          datasource={datasource}
          query={{ ...validLogsQuery, region: 'us-east-1' }}
          onChange={onChange}
          onRunQuery={jest.fn()}
        />
      );
      await waitFor(() => expect(screen.queryByText('us-east-1')).toBeInTheDocument());
      await act(async () => {
        await selectEvent.select(screen.getByLabelText(/Region/), 'us-east-2', { container: document.body });
      });
      expect(datasource.api.isMonitoringAccount).not.toHaveBeenCalledWith();
    });
  });
});

import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';

import { config } from '@grafana/runtime';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import { validLogsQuery, validMetricSearchBuilderQuery } from '../__mocks__/queries';
import { DEFAULT_LOGS_QUERY_STRING } from '../defaultQueries';

import QueryHeader from './QueryHeader';

const originalFeatureToggleValue = config.featureToggles.cloudWatchCrossAccountQuerying;
const ds = setupMockedDataSource({
  variables: [],
});
ds.datasource.resources.getRegions = jest.fn().mockResolvedValue([]);

describe('QueryHeader', () => {
  describe('when changing region', () => {
    afterEach(() => {
      config.featureToggles.cloudWatchCrossAccountQuerying = originalFeatureToggleValue;
    });
    const { datasource } = setupMockedDataSource();
    datasource.resources.getRegions = jest.fn().mockResolvedValue([
      { value: 'us-east-2', label: 'us-east-2' },
      { value: 'us-east-1', label: 'us-east-1' },
    ]);
    it('should reset account id if new region is not monitoring account', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      const onChange = jest.fn();
      datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
      render(
        <QueryHeader
          datasource={datasource}
          query={{ ...validMetricSearchBuilderQuery, region: 'us-east-1', accountId: 'all' }}
          onChange={onChange}
          onRunQuery={jest.fn()}
          dataIsStale={false}
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
      datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(true);

      render(
        <QueryHeader
          datasource={datasource}
          query={{ ...validMetricSearchBuilderQuery, region: 'us-east-1', accountId: '123' }}
          onChange={onChange}
          onRunQuery={jest.fn()}
          dataIsStale={false}
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
      datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(true);

      render(
        <QueryHeader
          dataIsStale={false}
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
      expect(datasource.resources.isMonitoringAccount).not.toHaveBeenCalledWith('us-east-2');
    });

    it('should not call isMonitoringAccount if feature toggle is not enabled', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = false;
      const onChange = jest.fn();
      datasource.resources.isMonitoringAccount = jest.fn();

      render(
        <QueryHeader
          dataIsStale={false}
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
      expect(datasource.resources.isMonitoringAccount).not.toHaveBeenCalledWith();
    });
  });

  describe('when changing query mode', () => {
    const { datasource } = setupMockedDataSource();
    it('should set default log query when switching to log mode', async () => {
      const onChange = jest.fn();
      datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
      render(
        <QueryHeader
          datasource={datasource}
          query={{ ...validMetricSearchBuilderQuery, expression: 'foo' }}
          onChange={onChange}
          onRunQuery={jest.fn()}
          dataIsStale={false}
        />
      );
      expect(await screen.findByText('CloudWatch Metrics')).toBeInTheDocument();
      await selectEvent.select(await screen.findByLabelText('Query mode'), 'CloudWatch Logs', {
        container: document.body,
      });
      expect(onChange).toHaveBeenCalledWith({
        ...validMetricSearchBuilderQuery,
        logGroupNames: undefined,
        logGroups: [],
        queryMode: 'Logs',
        sqlExpression: '',
        expression: DEFAULT_LOGS_QUERY_STRING,
      });
    });

    it('should set expression to empty when switching to metrics mode', async () => {
      const onChange = jest.fn();
      datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
      render(
        <QueryHeader
          datasource={datasource}
          query={{ ...validMetricSearchBuilderQuery, queryMode: 'Logs', expression: 'foo' }}
          onChange={onChange}
          onRunQuery={jest.fn()}
          dataIsStale={false}
        />
      );
      expect(await screen.findByText('CloudWatch Logs')).toBeInTheDocument();
      await selectEvent.select(await screen.findByLabelText('Query mode'), 'CloudWatch Metrics', {
        container: document.body,
      });
      expect(onChange).toHaveBeenCalledWith({
        ...validMetricSearchBuilderQuery,
        logGroupNames: undefined,
        logGroups: [],
        sqlExpression: '',
        expression: '',
      });
    });
  });
  describe('log expression', () => {
    const { datasource } = setupMockedDataSource();
    it('should disable run query button when empty', async () => {
      const onChange = jest.fn();
      datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
      render(
        <QueryHeader
          datasource={datasource}
          query={{ ...validMetricSearchBuilderQuery, queryMode: 'Logs', expression: '' }}
          onChange={onChange}
          onRunQuery={jest.fn()}
          dataIsStale={false}
        />
      );
      expect(await screen.findByText('Run queries')).toBeInTheDocument();
      expect(screen.getByText('Run queries').closest('button')).toBeDisabled();
    });
    it('should enable run query button when set', async () => {
      const onChange = jest.fn();
      datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
      render(
        <QueryHeader
          datasource={datasource}
          query={{ ...validMetricSearchBuilderQuery, queryMode: 'Logs', expression: DEFAULT_LOGS_QUERY_STRING }}
          onChange={onChange}
          onRunQuery={jest.fn()}
          dataIsStale={false}
        />
      );
      expect(await screen.findByText('Run queries')).toBeInTheDocument();
      expect(screen.getByText('Run queries').closest('button')).not.toBeDisabled();
    });
  });
});

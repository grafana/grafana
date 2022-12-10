import { render, screen } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import { CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType } from '../../types';

import MetricsQueryHeader from './MetricsQueryHeader';

const ds = setupMockedDataSource({
  variables: [],
});
ds.datasource.api.getRegions = jest.fn().mockResolvedValue([]);
const query: CloudWatchMetricsQuery = {
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

describe('MetricsQueryHeader', () => {
  describe('confirm modal', () => {
    it('should be shown when moving from code editor to builder when in sql mode', async () => {
      const onChange = jest.fn();
      const onRunQuery = jest.fn();
      query.metricEditorMode = MetricEditorMode.Code;
      query.metricQueryType = MetricQueryType.Query;

      render(
        <MetricsQueryHeader
          sqlCodeEditorIsDirty={true}
          datasource={ds.datasource}
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          isMonitoringAccount={false}
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

    it('should not be shown when moving from builder to code when in sql mode', async () => {
      const onChange = jest.fn();
      const onRunQuery = jest.fn();
      query.metricEditorMode = MetricEditorMode.Builder;
      query.metricQueryType = MetricQueryType.Query;

      render(
        <MetricsQueryHeader
          sqlCodeEditorIsDirty={true}
          datasource={ds.datasource}
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          isMonitoringAccount={false}
        />
      );

      const builderElement = screen.getByLabelText('Code');
      expect(builderElement).toBeInTheDocument();
      await act(async () => {
        await builderElement.click();
      });

      const modalTitleElem = screen.queryByText('Are you sure?');
      expect(modalTitleElem).toBeNull();
      expect(onChange).toHaveBeenCalled();
    });

    it('should not be shown when moving from code to builder when in standard mode', async () => {
      const onChange = jest.fn();
      const onRunQuery = jest.fn();
      query.metricEditorMode = MetricEditorMode.Code;
      query.metricQueryType = MetricQueryType.Search;

      render(
        <MetricsQueryHeader
          sqlCodeEditorIsDirty={true}
          datasource={ds.datasource}
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          isMonitoringAccount={false}
        />
      );

      const builderElement = screen.getByLabelText('Builder');
      expect(builderElement).toBeInTheDocument();
      await act(async () => {
        await builderElement.click();
      });

      const modalTitleElem = screen.queryByText('Are you sure?');
      expect(modalTitleElem).toBeNull();
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('should call run query when run button is clicked when in metric query mode', async () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    query.metricEditorMode = MetricEditorMode.Code;
    query.metricQueryType = MetricQueryType.Query;

    render(
      <MetricsQueryHeader
        sqlCodeEditorIsDirty={true}
        datasource={ds.datasource}
        query={query}
        onChange={onChange}
        onRunQuery={onRunQuery}
        isMonitoringAccount={false}
      />
    );

    const runQueryButton = screen.getByText('Run query');
    expect(runQueryButton).toBeInTheDocument();
    await act(async () => {
      await runQueryButton.click();
    });
    expect(onRunQuery).toHaveBeenCalled();
  });
});

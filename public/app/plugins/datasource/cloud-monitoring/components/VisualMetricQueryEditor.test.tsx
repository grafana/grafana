import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { openMenu, select } from 'react-select-event';

import { getDefaultTimeRange } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { createMockDatasource } from '../__mocks__/cloudMonitoringDatasource';
import { createMockMetricDescriptor } from '../__mocks__/cloudMonitoringMetricDescriptor';
import { createMockTimeSeriesList } from '../__mocks__/cloudMonitoringQuery';
import { PreprocessorType, MetricKind } from '../types/query';

import { defaultTimeSeriesList } from './MetricQueryEditor';
import { VisualMetricQueryEditor } from './VisualMetricQueryEditor';

const defaultProps = {
  refId: 'refId',
  customMetaData: {},
  variableOptionGroup: { options: [] },
  aliasBy: '',
  onChangeAliasBy: jest.fn(),
};

describe('VisualMetricQueryEditor', () => {
  it('renders metrics fields', async () => {
    const onChange = jest.fn();
    const query = createMockTimeSeriesList();
    const datasource = createMockDatasource();
    const range = getDefaultTimeRange();

    render(
      <VisualMetricQueryEditor
        {...defaultProps}
        onChange={onChange}
        datasource={datasource}
        query={query}
        range={range}
      />
    );

    expect(await screen.findByLabelText('Service')).toBeInTheDocument();
    expect(await screen.findByLabelText('Metric name')).toBeInTheDocument();
  });

  it('can select a service', async () => {
    const onChange = jest.fn();
    const query = createMockTimeSeriesList();
    const mockMetricDescriptor = createMockMetricDescriptor();
    const datasource = createMockDatasource({
      getMetricTypes: jest.fn().mockResolvedValue([mockMetricDescriptor]),
      getLabels: jest.fn().mockResolvedValue([]),
    });
    const range = getDefaultTimeRange();

    render(
      <VisualMetricQueryEditor
        {...defaultProps}
        onChange={onChange}
        datasource={datasource}
        query={query}
        range={range}
      />
    );

    const service = await screen.findByLabelText('Service');
    openMenu(service);
    await act(async () => {
      await select(service, 'Srv', { container: document.body });
    });
    expect(onChange).toBeCalledWith(
      expect.objectContaining({ filters: ['metric.type', '=', mockMetricDescriptor.type] })
    );
  });

  it('can select a metric name', async () => {
    const onChange = jest.fn();
    const query = createMockTimeSeriesList();
    const mockMetricDescriptor = createMockMetricDescriptor({ displayName: 'metricName_test', type: 'test_type' });
    const datasource = createMockDatasource({
      getMetricTypes: jest.fn().mockResolvedValue([createMockMetricDescriptor(), mockMetricDescriptor]),
      filterMetricsByType: jest.fn().mockResolvedValue([createMockMetricDescriptor(), mockMetricDescriptor]),
      getLabels: jest.fn().mockResolvedValue([]),
    });
    const range = getDefaultTimeRange();

    render(
      <VisualMetricQueryEditor
        {...defaultProps}
        onChange={onChange}
        datasource={datasource}
        query={query}
        range={range}
      />
    );

    const service = await screen.findByLabelText('Service');
    openMenu(service);
    await act(async () => {
      await select(service, 'Srv', { container: document.body });
    });
    const metricName = await screen.findByLabelText('Metric name');
    openMenu(metricName);
    await userEvent.type(metricName, 'test');
    await waitFor(() => expect(document.body).toHaveTextContent('metricName_test'));
    await act(async () => {
      await select(metricName, 'metricName_test', { container: document.body });
    });
    expect(onChange).toBeCalledWith(
      expect.objectContaining({ filters: ['metric.type', '=', mockMetricDescriptor.type] })
    );
  });

  it('should have a distinct list of services', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getMetricTypes: jest.fn().mockResolvedValue([
        createMockMetricDescriptor({
          service: 'service_a',
          serviceShortName: 'srv_a',
          type: 'metric1',
          description: 'description_metric1',
          displayName: 'displayName_metric1',
        }),
        createMockMetricDescriptor({
          service: 'service_b',
          serviceShortName: 'srv_b',
          type: 'metric2',
          description: 'description_metric2',
          displayName: 'displayName_metric2',
        }),
        createMockMetricDescriptor({
          service: 'service_b',
          serviceShortName: 'srv_b',
          type: 'metric3',
          description: 'description_metric3',
          displayName: 'displayName_metric3',
        }),
      ]),
    });
    const query = createMockTimeSeriesList();
    const range = getDefaultTimeRange();

    render(
      <VisualMetricQueryEditor
        {...defaultProps}
        onChange={onChange}
        datasource={datasource}
        query={query}
        range={range}
      />
    );
    const service = await screen.findByLabelText('Service');
    openMenu(service);
    expect(screen.getAllByLabelText('Select option').length).toEqual(2);
  });

  it('resets query to default when service changes', async () => {
    const query = createMockTimeSeriesList({ filters: ['metric.test_label', '=', 'test', 'AND'] });
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getMetricTypes: jest
        .fn()
        .mockResolvedValue([
          createMockMetricDescriptor(),
          createMockMetricDescriptor({ type: 'type2', service: 'service2', serviceShortName: 'srv2' }),
        ]),
      getLabels: jest.fn().mockResolvedValue([]),
    });
    const defaultQuery = { ...query, ...defaultTimeSeriesList(datasource), filters: ['metric.type', '=', 'type2'] };
    const range = getDefaultTimeRange();

    render(
      <VisualMetricQueryEditor
        {...defaultProps}
        onChange={onChange}
        datasource={datasource}
        query={query}
        range={range}
      />
    );

    expect(screen.getByText('metric.test_label')).toBeInTheDocument();
    const service = await screen.findByLabelText('Service');
    openMenu(service);
    await act(async () => {
      await select(service, 'Srv 2', { container: document.body });
    });
    expect(onChange).toBeCalledWith(expect.objectContaining({ filters: ['metric.type', '=', 'type2'] }));
    expect(query).toEqual(defaultQuery);
    expect(screen.queryByText('metric.test_label')).not.toBeInTheDocument();
  });

  it('resets query to defaults (except filters) when metric changes', async () => {
    const groupBys = ['metric.test_groupby'];
    const query = createMockTimeSeriesList({
      filters: ['metric.test_label', '=', 'test', 'AND', 'metric.type', '=', 'type'],
      groupBys,
      preprocessor: PreprocessorType.Delta,
    });
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      filterMetricsByType: jest
        .fn()
        .mockResolvedValue([
          createMockMetricDescriptor(),
          createMockMetricDescriptor({ type: 'type2', displayName: 'metricName2', metricKind: MetricKind.GAUGE }),
        ]),
      getMetricTypes: jest
        .fn()
        .mockResolvedValue([
          createMockMetricDescriptor(),
          createMockMetricDescriptor({ type: 'type2', displayName: 'metricName2', metricKind: MetricKind.GAUGE }),
        ]),
      getLabels: jest.fn().mockResolvedValue({ 'metric.test_groupby': '' }),
      templateSrv: getTemplateSrv(),
    });
    const defaultQuery = { ...query, ...defaultTimeSeriesList(datasource), filters: query.filters };
    const range = getDefaultTimeRange();

    render(
      <VisualMetricQueryEditor
        {...defaultProps}
        onChange={onChange}
        datasource={datasource}
        query={query}
        range={range}
      />
    );
    expect(document.body).toHaveTextContent('metric.test_label');
    expect(await screen.findByText('Delta')).toBeInTheDocument();
    expect(await screen.findByText('metric.test_groupby')).toBeInTheDocument();
    const metric = await screen.findByLabelText('Metric name');
    openMenu(metric);
    await userEvent.type(metric, 'type2');
    await waitFor(() => expect(document.body).toHaveTextContent('metricName2'));
    await act(async () => {
      await select(metric, 'metricName2', { container: document.body });
    });
    expect(onChange).toBeCalledWith(
      expect.objectContaining({ filters: ['metric.test_label', '=', 'test', 'AND', 'metric.type', '=', 'type2'] })
    );
    expect(query).toEqual(defaultQuery);
    expect(document.body).toHaveTextContent('metric.test_label');
    expect(screen.queryByText('Delta')).not.toBeInTheDocument();
    expect(screen.queryByText('metric.test_groupby')).not.toBeInTheDocument();
  });

  it('updates labels on time range change', async () => {
    const range = getDefaultTimeRange();
    const query = createMockTimeSeriesList();
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getMetricTypes: jest.fn().mockResolvedValue([createMockMetricDescriptor()]),
      getLabels: jest.fn().mockResolvedValue({ 'metric.test_groupby_1': '' }),
      templateSrv: getTemplateSrv(),
    });

    const { rerender } = render(
      <VisualMetricQueryEditor
        {...defaultProps}
        onChange={onChange}
        datasource={datasource}
        query={query}
        range={range}
      />
    );

    const service = await screen.findByLabelText('Service');
    openMenu(service);
    await act(async () => {
      await select(service, 'Srv', { container: document.body });
    });
    const metricName = await screen.findByLabelText('Metric name');
    openMenu(metricName);
    await waitFor(() => expect(document.body).toHaveTextContent('metricName'));
    await act(async () => {
      await select(metricName, 'metricName', { container: document.body });
    });
    const groupBy = await screen.findByLabelText('Group by');
    openMenu(groupBy);
    await waitFor(() => expect(document.body).toHaveTextContent('metric.test_groupby'));
    // timeRange.from ({ from: 'now-12h', to: 'now' });
    const datasourceUpdated = createMockDatasource({
      getLabels: jest.fn().mockResolvedValue({ 'metric.test_groupby_1': '' }),
    });

    rerender(
      <VisualMetricQueryEditor
        {...defaultProps}
        onChange={onChange}
        datasource={datasourceUpdated}
        query={query}
        range={range}
      />
    );
    openMenu(groupBy);
    await waitFor(() => expect(document.body).toHaveTextContent('metric.test_groupby_1'));
  });
});

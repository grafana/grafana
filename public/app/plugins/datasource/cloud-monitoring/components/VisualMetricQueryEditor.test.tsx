import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { openMenu, select } from 'react-select-event';

import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { createMockDatasource } from '../__mocks__/cloudMonitoringDatasource';
import { createMockMetricDescriptor } from '../__mocks__/cloudMonitoringMetricDescriptor';
import { createMockTimeSeriesList } from '../__mocks__/cloudMonitoringQuery';
import { MetricKind, PreprocessorType } from '../types';

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

    render(<VisualMetricQueryEditor {...defaultProps} onChange={onChange} datasource={datasource} query={query} />);

    expect(screen.getByText('metric.test_label')).toBeInTheDocument();
    const service = await screen.findByLabelText('Service');
    openMenu(service);
    await select(service, 'Srv 2', { container: document.body });
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
      getMetricTypes: jest
        .fn()
        .mockResolvedValue([
          createMockMetricDescriptor(),
          createMockMetricDescriptor({ type: 'type2', displayName: 'metricName2', metricKind: MetricKind.GAUGE }),
        ]),
      getLabels: jest.fn().mockResolvedValue({ 'metric.test_groupby': '' }),
      templateSrv: new TemplateSrv(),
    });
    const defaultQuery = { ...query, ...defaultTimeSeriesList(datasource), filters: query.filters };

    render(<VisualMetricQueryEditor {...defaultProps} onChange={onChange} datasource={datasource} query={query} />);
    expect(document.body).toHaveTextContent('metric.test_label');
    expect(await screen.findByText('Delta')).toBeInTheDocument();
    expect(await screen.findByText('metric.test_groupby')).toBeInTheDocument();
    const metric = await screen.findByLabelText('Metric name');
    openMenu(metric);
    await select(metric, 'metricName2', { container: document.body });
    expect(onChange).toBeCalledWith(
      expect.objectContaining({ filters: ['metric.test_label', '=', 'test', 'AND', 'metric.type', '=', 'type2'] })
    );
    expect(query).toEqual(defaultQuery);
    expect(document.body).toHaveTextContent('metric.test_label');
    expect(await screen.queryByText('Delta')).not.toBeInTheDocument();
    expect(await screen.queryByText('metric.test_groupby')).not.toBeInTheDocument();
  });
});

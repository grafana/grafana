import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { TemplateSrvMock } from 'app/features/templating/template_srv.mock';

import { createMockMetricDescriptor } from '../__mocks__/cloudMonitoringMetricDescriptor';
import { createMockTimeSeriesList } from '../__mocks__/cloudMonitoringQuery';
import { MetricKind, ValueTypes } from '../types';

import { Preprocessor } from './Preprocessor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => new TemplateSrvMock({}),
}));

describe('Preprocessor', () => {
  it('only provides "None" as an option if no metric descriptor is provided', () => {
    const query = createMockTimeSeriesList();
    const onChange = jest.fn();

    render(<Preprocessor onChange={onChange} query={query} />);
    expect(screen.getByText('Pre-processing')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByText('Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('Delta')).not.toBeInTheDocument();
  });

  it('only provides "None" as an option if metric kind is "Gauge"', () => {
    const query = createMockTimeSeriesList();
    const onChange = jest.fn();
    const metricDescriptor = createMockMetricDescriptor({ metricKind: MetricKind.GAUGE });

    render(<Preprocessor onChange={onChange} query={query} metricDescriptor={metricDescriptor} />);
    expect(screen.getByText('Pre-processing')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByText('Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('Delta')).not.toBeInTheDocument();
  });

  it('only provides "None" as an option if value type is "Distribution"', () => {
    const query = createMockTimeSeriesList();
    const onChange = jest.fn();
    const metricDescriptor = createMockMetricDescriptor({ valueType: ValueTypes.DISTRIBUTION });

    render(<Preprocessor onChange={onChange} query={query} metricDescriptor={metricDescriptor} />);
    expect(screen.getByText('Pre-processing')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByText('Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('Delta')).not.toBeInTheDocument();
  });

  it('provides "None" and "Rate" as options if metric kind is not "Delta" or "Cumulative" and value type is not "Distribution"', () => {
    const query = createMockTimeSeriesList();
    const onChange = jest.fn();
    const metricDescriptor = createMockMetricDescriptor({ metricKind: MetricKind.DELTA });

    render(<Preprocessor onChange={onChange} query={query} metricDescriptor={metricDescriptor} />);
    expect(screen.getByText('Pre-processing')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByText('Rate')).toBeInTheDocument();
    expect(screen.queryByText('Delta')).not.toBeInTheDocument();
  });

  it('provides all options if metric kind is "Cumulative" and value type is not "Distribution"', () => {
    const query = createMockTimeSeriesList();
    const onChange = jest.fn();
    const metricDescriptor = createMockMetricDescriptor({ metricKind: MetricKind.CUMULATIVE });

    render(<Preprocessor onChange={onChange} query={query} metricDescriptor={metricDescriptor} />);
    expect(screen.getByText('Pre-processing')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByText('Rate')).toBeInTheDocument();
    expect(screen.queryByText('Delta')).toBeInTheDocument();
  });

  it('provides all options if metric kind is "Cumulative" and value type is not "Distribution"', async () => {
    const query = createMockTimeSeriesList();
    const onChange = jest.fn();
    const metricDescriptor = createMockMetricDescriptor({ metricKind: MetricKind.CUMULATIVE });

    render(<Preprocessor onChange={onChange} query={query} metricDescriptor={metricDescriptor} />);
    const none = screen.getByLabelText('None');
    const rate = screen.getByLabelText('Rate');
    const delta = screen.getByLabelText('Delta');
    expect(none).toBeChecked();
    expect(rate).not.toBeChecked();
    expect(delta).not.toBeChecked();

    await userEvent.click(rate);

    expect(onChange).toBeCalledWith(expect.objectContaining({ preprocessor: 'rate' }));
  });
});

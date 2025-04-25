import { render, screen } from '@testing-library/react';

import { dateTime } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PromVisualQuery } from '../types';

import { MetricsLabelsSection } from './MetricsLabelsSection';

// Mock dependencies
jest.mock('./MetricCombobox', () => ({
  MetricCombobox: jest.fn(() => <div data-testid="metric-combobox">Metric Combobox</div>),
}));

jest.mock('./LabelFilters', () => ({
  LabelFilters: jest.fn(() => <div data-testid="label-filters">Label Filters</div>),
}));

// Create mock for PrometheusDatasource
const createMockDatasource = () => {
  const datasource = {
    uid: 'prometheus',
    getVariables: jest.fn().mockReturnValue(['$var1', '$var2']),
    interpolateString: jest.fn((str) => str),
    hasLabelsMatchAPISupport: jest.fn().mockReturnValue(true),
    getDebounceTimeInMilliseconds: jest.fn().mockReturnValue(300),
    lookupsDisabled: false,
    languageProvider: {
      fetchLabels: jest.fn().mockResolvedValue({}),
      getLabelKeys: jest.fn().mockReturnValue(['label1', 'label2']),
      fetchLabelsWithMatch: jest.fn().mockResolvedValue({ label1: [], label2: [] }),
      fetchSeries: jest.fn().mockResolvedValue([{ label1: 'value1' }]),
      fetchSeriesValuesWithMatch: jest.fn().mockResolvedValue(['value1', 'value2']),
      getLabelValues: jest.fn().mockResolvedValue(['value1', 'value2']),
      getSeries: jest.fn().mockResolvedValue({ __name__: ['metric1', 'metric2'] }),
      loadMetricsMetadata: jest.fn().mockResolvedValue({}),
      metricsMetadata: { metric1: { type: 'counter', help: 'help text' } },
    },
  };
  return datasource as unknown as PrometheusDatasource;
};

const defaultQuery: PromVisualQuery = {
  metric: 'metric1',
  labels: [{ label: 'label1', op: '=', value: 'value1' }],
  operations: [],
};

const defaultTimeRange = {
  from: dateTime(1000),
  to: dateTime(2000),
  raw: {
    from: 'now-1h',
    to: 'now',
  },
};

describe('MetricsLabelsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render MetricCombobox and LabelFilters', () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    expect(screen.getByTestId('metric-combobox')).toBeInTheDocument();
    expect(screen.getByTestId('label-filters')).toBeInTheDocument();
  });

  it('should pass correct props to MetricCombobox', async () => {
    const onChange = jest.fn();
    const onBlur = jest.fn();
    const datasource = createMockDatasource();
    const { MetricCombobox } = require('./MetricCombobox');

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        onBlur={onBlur}
        timeRange={defaultTimeRange}
      />
    );

    // Check that MetricCombobox was called with correct props
    expect(MetricCombobox).toHaveBeenCalledWith(
      expect.objectContaining({
        query: defaultQuery,
        onChange: onChange,
        datasource: datasource,
        labelsFilters: defaultQuery.labels,
        metricLookupDisabled: false,
        onBlur: onBlur,
        variableEditor: undefined,
      }),
      expect.anything()
    );
  });

  it('should pass correct props to LabelFilters', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    const { LabelFilters } = require('./LabelFilters');

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    // Check that LabelFilters was called with correct props
    expect(LabelFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        debounceDuration: 300,
        labelsFilters: defaultQuery.labels,
        variableEditor: undefined,
      }),
      expect.anything()
    );
  });

  it('should handle onChangeLabels correctly', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    const { LabelFilters } = require('./LabelFilters');

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    // Extract the onChangeLabels callback
    const onChangeLabelsCallback = LabelFilters.mock.calls[0][0].onChange;

    // Call it with new labels
    const newLabels = [{ label: 'newLabel', op: '=', value: 'newValue' }];
    onChangeLabelsCallback(newLabels);

    // Check that onChange was called with updated query
    expect(onChange).toHaveBeenCalledWith({
      ...defaultQuery,
      labels: newLabels,
    });
  });

  it('should handle withTemplateVariableOptions correctly', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    const { LabelFilters } = require('./LabelFilters');

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    // Extract the onGetLabelNames callback
    const onGetLabelNamesCallback = LabelFilters.mock.calls[0][0].onGetLabelNames;

    // Prepare a test label filter
    const forLabel = { label: 'test', op: '=', value: '' };

    // Call it
    const result = await onGetLabelNamesCallback(forLabel);

    // Check that variables were included in the result
    expect(result).toContainEqual(expect.objectContaining({ label: '$var1', value: '$var1' }));
    expect(result).toContainEqual(expect.objectContaining({ label: '$var2', value: '$var2' }));
  });

  it('should handle onGetLabelNames with no metric correctly', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    const { LabelFilters } = require('./LabelFilters');
    const queryWithoutMetric = { ...defaultQuery, metric: '' };

    render(
      <MetricsLabelsSection
        query={queryWithoutMetric}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    // Extract the onGetLabelNames callback
    const onGetLabelNamesCallback = LabelFilters.mock.calls[0][0].onGetLabelNames;

    // Call it
    await onGetLabelNamesCallback({});

    // Check that fetchLabels was called
    expect(datasource.languageProvider.fetchLabels).toHaveBeenCalledWith(defaultTimeRange);
    // Check that getLabelKeys was called
    expect(datasource.languageProvider.getLabelKeys).toHaveBeenCalled();
  });

  it('should handle onGetLabelNames with metric correctly', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    const { LabelFilters } = require('./LabelFilters');

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    // Extract the onGetLabelNames callback
    const onGetLabelNamesCallback = LabelFilters.mock.calls[0][0].onGetLabelNames;

    // Call it
    await onGetLabelNamesCallback({});

    // Check that fetchLabelsWithMatch was called
    expect(datasource.languageProvider.fetchLabelsWithMatch).toHaveBeenCalled();
  });

  it('should handle getLabelValuesAutocompleteSuggestions correctly', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    const { LabelFilters } = require('./LabelFilters');

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    // Extract the getLabelValuesAutofillSuggestions callback
    const getLabelValuesCallback = LabelFilters.mock.calls[0][0].getLabelValuesAutofillSuggestions;

    // Call it
    await getLabelValuesCallback('val', 'label1');

    // Check that fetchSeriesValuesWithMatch was called (since hasLabelsMatchAPISupport is true)
    expect(datasource.languageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
  });

  it('should handle onGetLabelValues with no metric correctly', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    const { LabelFilters } = require('./LabelFilters');
    const queryWithoutMetric = { ...defaultQuery, metric: '' };

    render(
      <MetricsLabelsSection
        query={queryWithoutMetric}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    // Extract the onGetLabelValues callback
    const onGetLabelValuesCallback = LabelFilters.mock.calls[0][0].onGetLabelValues;

    // Call it
    await onGetLabelValuesCallback({ label: 'label1' });

    // Check that getLabelValues was called
    expect(datasource.languageProvider.getLabelValues).toHaveBeenCalledWith(defaultTimeRange, 'label1');
  });

  it('should handle onGetLabelValues with metric correctly', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    const { LabelFilters } = require('./LabelFilters');

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    // Extract the onGetLabelValues callback
    const onGetLabelValuesCallback = LabelFilters.mock.calls[0][0].onGetLabelValues;

    // Call it
    await onGetLabelValuesCallback({ label: 'label1' });

    // Check that fetchSeriesValuesWithMatch was called (since hasLabelsMatchAPISupport is true)
    expect(datasource.languageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
  });

  it('should handle onGetLabelValues with no label correctly', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    const { LabelFilters } = require('./LabelFilters');

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    // Extract the onGetLabelValues callback
    const onGetLabelValuesCallback = LabelFilters.mock.calls[0][0].onGetLabelValues;

    // Call it with no label
    const result = await onGetLabelValuesCallback({});

    // In reality, the component has already added the template variables to the result
    // Let's check that the result includes the template variables
    expect(result).toContainEqual(expect.objectContaining({ label: '$var1', value: '$var1' }));
    expect(result).toContainEqual(expect.objectContaining({ label: '$var2', value: '$var2' }));
  });

  it('should handle onGetMetrics correctly', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    const { MetricCombobox } = require('./MetricCombobox');

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    // Extract the onGetMetrics callback
    const onGetMetricsCallback = MetricCombobox.mock.calls[0][0].onGetMetrics;

    // Call it
    const result = await onGetMetricsCallback();

    // Check that we get back variables and metrics
    expect(result).toContainEqual(expect.objectContaining({ label: '$var1', value: '$var1' }));
    expect(result).toContainEqual(expect.objectContaining({ label: '$var2', value: '$var2' }));
    // Metrics should be included too, but they come from the mocked getSeries or getLabelValues
  });

  it('should load metrics metadata if not present', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();
    datasource.languageProvider.metricsMetadata = undefined;

    render(
      <MetricsLabelsSection
        query={defaultQuery}
        datasource={datasource}
        onChange={onChange}
        timeRange={defaultTimeRange}
      />
    );

    const { MetricCombobox } = require('./MetricCombobox');
    const onGetMetricsCallback = MetricCombobox.mock.calls[0][0].onGetMetrics;

    // Call it
    await onGetMetricsCallback();

    // loadMetricsMetadata should be called
    expect(datasource.languageProvider.loadMetricsMetadata).toHaveBeenCalled();
  });
});

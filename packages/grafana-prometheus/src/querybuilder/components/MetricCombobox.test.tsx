import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import '@testing-library/jest-dom';

import { DataSourceInstanceSettings } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PrometheusLanguageProviderInterface } from '../../language_provider';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { getMockTimeRange } from '../../test/mocks/datasource';
import { PromOptions } from '../../types';

import { MetricCombobox, MetricComboboxProps } from './MetricCombobox';

describe('MetricCombobox', () => {
  beforeAll(() => {
    const mockGetBoundingClientRect = jest.fn(() => ({
      width: 120,
      height: 120,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    }));

    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: mockGetBoundingClientRect,
    });
  });

  const instanceSettings = {
    url: 'proxied',
    id: 1,
    user: 'test',
    password: 'mupp',
    jsonData: { httpMethod: 'GET' },
  } as unknown as DataSourceInstanceSettings<PromOptions>;

  const mockLanguageProvider = new EmptyLanguageProviderMock() as unknown as PrometheusLanguageProviderInterface;
  const mockDatasource = new PrometheusDatasource(instanceSettings, undefined, mockLanguageProvider);

  // Options returned when user first opens the combobox - returned by onGetMetrics
  const initialMockValues = [{ label: 'top_metric_one' }, { label: 'top_metric_two' }, { label: 'top_metric_three' }];
  const mockOnGetMetrics = jest.fn(() => Promise.resolve(initialMockValues.map((v) => ({ value: v.label }))));

  const mockOnChange = jest.fn();

  const defaultProps: MetricComboboxProps = {
    metricLookupDisabled: false,
    query: {
      metric: '',
      labels: [],
      operations: [],
    },
    onChange: mockOnChange,
    onGetMetrics: mockOnGetMetrics,
    datasource: mockDatasource,
    labelsFilters: [],
    variableEditor: false,
    timeRange: getMockTimeRange(),
  };

  beforeEach(() => {
    mockDatasource.lazyLoading = false;
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<MetricCombobox {...defaultProps} />);
    expect(screen.getByPlaceholderText('Select metric')).toBeInTheDocument();
  });

  it('should display expected placeholder when lazyloading enabled', async () => {
    mockDatasource.lazyLoading = true;
    mockDatasource.lazyLoadingLengthThreshold = 5;
    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Please type at least 5 characters');
    expect(combobox).toBeTruthy();
  });

  it('should display expected placeholder when lazyloading disabled', async () => {
    mockDatasource.lazyLoading = false;
    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Select metric');
    expect(combobox).toBeTruthy();
  });

  it('should display "No options found." by default when lazyloading enabled', async () => {
    mockDatasource.lazyLoading = true;
    mockDatasource.lazyLoadingLengthThreshold = 5;
    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Please type at least 5 characters');
    await userEvent.click(combobox);
    const element = screen.getByText('No options found.');
    expect(element).toBeInTheDocument();
  });

  it('should display empty options when input length is lower than threshold', async () => {
    mockDatasource.languageProvider.queryLabelValues = jest.fn().mockResolvedValue(['unique_metric']);
    mockDatasource.lazyLoading = true;
    mockDatasource.lazyLoadingLengthThreshold = 5;
    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Please type at least 5 characters');
    await userEvent.click(combobox);
    userEvent.type(combobox, 'uni');
    const element = screen.getByText('No options found.');
    expect(element).toBeInTheDocument();
  });

  it('should display expected options when input length is greater than threshold', async () => {
    mockDatasource.languageProvider.queryLabelValues = jest.fn().mockResolvedValue(['unique_metric']);
    mockDatasource.lazyLoading = true;
    mockDatasource.lazyLoadingLengthThreshold = 5;
    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Please type at least 5 characters');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'unique_m');
    const item = await screen.findByRole('option', { name: 'unique_metric' });
    expect(item).toBeInTheDocument();
  });

  it('fetches top metrics when the combobox is opened ', async () => {
    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Select metric');
    await userEvent.click(combobox);

    const item = await screen.findByRole('option', { name: 'top_metric_one' });
    expect(item).toBeInTheDocument();

    // This should be asserted by the above check, but double check anyway
    expect(mockOnGetMetrics).toHaveBeenCalledTimes(1);
  });

  it('fetches metrics for the users query', async () => {
    // Mock the queryLabelValues to return the expected metric
    mockDatasource.languageProvider.queryLabelValues = jest.fn().mockResolvedValue(['unique_metric']);

    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Select metric');
    await userEvent.click(combobox);
    await userEvent.type(combobox, 'unique');

    const item = await screen.findByRole('option', { name: 'unique_metric' });
    expect(item).toBeInTheDocument();

    // This should be asserted by the above check, but double check anyway
    // This is the actual argument, created by formatKeyValueStrings()
    expect(mockDatasource.languageProvider.queryLabelValues).toHaveBeenCalledWith(
      expect.anything(),
      '__name__',
      '{__name__=~".*unique.*"}'
    );
  });

  it('calls onChange with the correct value when a metric is selected', async () => {
    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Select metric');
    await userEvent.click(combobox);

    const item = await screen.findByRole('option', { name: 'top_metric_two' });
    await userEvent.click(item);

    expect(mockOnChange).toHaveBeenCalledWith({ metric: 'top_metric_two', labels: [], operations: [] });
  });

  it('shows the metrics explorer button by default', () => {
    render(<MetricCombobox {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /open metrics explorer/i })).toBeInTheDocument();
  });

  it('displays the default metric value from query prop', () => {
    // Render with a query that has a default metric value
    render(
      <MetricCombobox
        {...defaultProps}
        query={{
          metric: 'default_metric_value',
          labels: [],
          operations: [],
        }}
      />
    );

    // The Combobox should display the default metric value
    const combobox = screen.getByPlaceholderText('Select metric');
    expect(combobox).toHaveValue('default_metric_value');
  });

  it('opens the metrics explorer when the button is clicked', async () => {
    render(<MetricCombobox {...defaultProps} onGetMetrics={() => Promise.resolve([])} />);

    const button = screen.getByRole('button', { name: /open metrics explorer/i });
    await userEvent.click(button);

    expect(screen.getByText('Metrics explorer')).toBeInTheDocument();
  });
});

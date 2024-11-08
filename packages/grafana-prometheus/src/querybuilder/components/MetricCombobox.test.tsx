import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import '@testing-library/jest-dom';

import { DataSourceInstanceSettings, MetricFindValue } from '@grafana/data';
import { config } from '@grafana/runtime';

import { PrometheusDatasource } from '../../datasource';
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

  const mockDatasource = new PrometheusDatasource(instanceSettings);
  const mockValues = [{ label: 'random_metric' }, { label: 'unique_metric' }, { label: 'more_unique_metric' }];

  // Mock metricFindQuery which will call backend API
  mockDatasource.metricFindQuery = jest.fn((query: string) => {
    // return Promise.resolve([]);
    // Use the label values regex to get the values inside the label_values function call
    const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;
    const queryValueArray = query.match(labelValuesRegex) as RegExpMatchArray;
    const queryValueRaw = queryValueArray[1];

    // Remove the wrapping regex
    const queryValue = queryValueRaw.substring(queryValueRaw.indexOf('".*') + 3, queryValueRaw.indexOf('.*"'));

    // Run the regex that we'd pass into prometheus API against the strings in the test
    return Promise.resolve(
      mockValues
        .filter((value) => value.label.match(queryValue))
        .map((result) => {
          return {
            text: result.label,
          };
        }) as MetricFindValue[]
    );
  });

  const mockOnChange = jest.fn();
  const mockOnGetMetrics = jest.fn(() => Promise.resolve(mockValues.map((v) => ({ value: v.label }))));

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
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<MetricCombobox {...defaultProps} />);
    expect(screen.getByPlaceholderText('Select metric')).toBeInTheDocument();
  });

  it('fetches top metrics when the combobox is opened ', async () => {
    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Select metric');
    await userEvent.click(combobox);

    expect(mockOnGetMetrics).toHaveBeenCalledTimes(1);

    const item = await screen.findByRole('option', { name: 'random_metric' });
    expect(item).toBeInTheDocument();
  });

  it('fetches metrics for the users query', async () => {
    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Select metric');
    await userEvent.click(combobox);

    await userEvent.type(combobox, 'unique');
    expect(jest.mocked(mockDatasource.metricFindQuery)).toHaveBeenCalled();

    const item = await screen.findByRole('option', { name: 'unique_metric' });
    expect(item).toBeInTheDocument();

    const negativeItem = await screen.queryByRole('option', { name: 'random_metric' });
    expect(negativeItem).not.toBeInTheDocument();
  });

  it('calls onChange with the correct value when a metric is selected', async () => {
    render(<MetricCombobox {...defaultProps} />);

    const combobox = screen.getByPlaceholderText('Select metric');
    await userEvent.click(combobox);

    const item = await screen.findByRole('option', { name: 'random_metric' });
    await userEvent.click(item);

    expect(mockOnChange).toHaveBeenCalledWith({ metric: 'random_metric', labels: [], operations: [] });
  });

  it("doesn't show the metrics explorer button by default", () => {
    render(<MetricCombobox {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /open metrics explorer/i })).not.toBeInTheDocument();
  });

  describe('when metrics explorer toggle is enabled', () => {
    beforeAll(() => {
      jest.replaceProperty(config, 'featureToggles', {
        prometheusMetricEncyclopedia: true,
      });
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('opens the metrics explorer when the button is clicked', async () => {
      render(<MetricCombobox {...defaultProps} onGetMetrics={() => Promise.resolve([])} />);

      const button = screen.getByRole('button', { name: /open metrics explorer/i });
      await userEvent.click(button);

      expect(screen.getByText('Metrics explorer')).toBeInTheDocument();
    });
  });
});

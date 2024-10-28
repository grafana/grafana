import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';
import { DataSourceInstanceSettings, MetricFindValue } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PromOptions } from '../../types';

import { MetricCombobox, MetricComboboxProps } from './MetricCombobox';

describe('MetricCombobox', () => {
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
  //@ts-ignore
  mockDatasource.metricFindQuery = jest.fn((query: string) => {
    // Use the label values regex to get the values inside the label_values function call
    const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;
    const queryValueArray = query.match(labelValuesRegex) as RegExpMatchArray;
    const queryValueRaw = queryValueArray[1] as string;

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
  const mockOnGetMetrics = jest.fn();

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

  it('calls onChange with the correct value when a metric is selected', () => {
    render(<MetricCombobox {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Select metric'), { target: { value: 'metric1' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Select metric'), { key: 'Enter', code: 'Enter' });
    expect(mockOnChange).toHaveBeenCalledWith({ metric: 'metric1' });
  });

  it('fetches metrics correctly when loadOptions is called', async () => {
    mockOnGetMetrics.mockResolvedValue([{ label: 'metric1', value: 'metric1' }]);
    render(<MetricCombobox {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Select metric'), { target: { value: 'metric' } });
    await waitFor(() => expect(mockOnGetMetrics).toHaveBeenCalled());
  });

  it('formats the results correctly in getMetricLabels', async () => {
    jest.mocked(mockDatasource.metricFindQuery).mockResolvedValue([{ text: 'metric1' }]);

    render(<MetricCombobox {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Select metric'), { target: { value: 'metric' } });
    await waitFor(() => expect(mockDatasource.metricFindQuery).toHaveBeenCalled());
  });
});

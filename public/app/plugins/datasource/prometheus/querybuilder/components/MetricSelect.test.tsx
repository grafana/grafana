import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceInstanceSettings, MetricFindValue } from '@grafana/data/src';

import { PrometheusDatasource } from '../../datasource';
import { PromOptions } from '../../types';

import { MetricSelect, Props } from './MetricSelect';

const instanceSettings = {
  url: 'proxied',
  id: 1,
  directUrl: 'direct',
  user: 'test',
  password: 'mupp',
  jsonData: { httpMethod: 'GET' },
} as unknown as DataSourceInstanceSettings<PromOptions>;

const dataSourceMock = new PrometheusDatasource(instanceSettings);
const mockValues = [{ label: 'random_metric' }, { label: 'unique_metric' }, { label: 'more_unique_metric' }];

// Mock metricFindQuery which will call backend API
//@ts-ignore
dataSourceMock.metricFindQuery = jest.fn((query: string) => {
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

const props: Props = {
  labelsFilters: [],
  datasource: dataSourceMock,
  query: {
    metric: '',
    labels: [],
    operations: [],
  },
  onChange: jest.fn(),
  onGetMetrics: jest.fn().mockResolvedValue(mockValues),
  metricLookupDisabled: false,
};

describe('MetricSelect', () => {
  it('shows all metric options', async () => {
    render(<MetricSelect {...props} />);
    await openMetricSelect();
    await waitFor(() => expect(screen.getByText('random_metric')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('unique_metric')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('more_unique_metric')).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(3));
  });

  it('shows option to set custom value when typing', async () => {
    render(<MetricSelect {...props} />);
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'custom value');
    await waitFor(() => expect(screen.getByText('custom value')).toBeInTheDocument());
  });

  it('shows searched options when typing', async () => {
    render(<MetricSelect {...props} />);
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'unique');
    await waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(3));
  });

  it('searches on split words', async () => {
    render(<MetricSelect {...props} />);
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'more unique');
    await waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(2));
  });

  it('searches on multiple split words', async () => {
    render(<MetricSelect {...props} />);
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'more unique metric');
    await waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(2));
  });

  it('highlights matching string', async () => {
    render(<MetricSelect {...props} />);
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'more');
    await waitFor(() => expect(document.querySelectorAll('mark')).toHaveLength(1));
  });

  it('highlights multiple matching strings in 1 input row', async () => {
    render(<MetricSelect {...props} />);
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'more metric');
    await waitFor(() => expect(document.querySelectorAll('mark')).toHaveLength(2));
  });

  it('highlights multiple matching strings in multiple input rows', async () => {
    render(<MetricSelect {...props} />);
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'unique metric');
    await waitFor(() => expect(document.querySelectorAll('mark')).toHaveLength(4));
  });

  it('does not highlight matching string in create option', async () => {
    render(<MetricSelect {...props} />);
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'new');
    await waitFor(() => expect(document.querySelector('mark')).not.toBeInTheDocument());
  });
});

async function openMetricSelect() {
  const select = screen.getByText('Select metric').parentElement!;
  await userEvent.click(select);
}

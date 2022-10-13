import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from '../../../../../store/configureStore';

import { MetricSelect } from './MetricSelect';

const props = {
  query: {
    metric: '',
    labels: [],
    operations: [],
  },
  onChange: jest.fn(),
  onGetMetrics: jest
    .fn()
    .mockResolvedValue([{ label: 'random_metric' }, { label: 'unique_metric' }, { label: 'more_unique_metric' }]),
};

describe('MetricSelect', () => {
  const renderMetricSelect = () => {
    const store = configureStore();

    render(
      <Provider store={store}>
        <MetricSelect {...props} />
      </Provider>
    );
  };
  it('shows all metric options', async () => {
    renderMetricSelect();
    await openMetricSelect();
    await waitFor(() => expect(screen.getByText('random_metric')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('unique_metric')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('more_unique_metric')).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(3));
  });

  it('shows option to set custom value when typing', async () => {
    renderMetricSelect();
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'custom value');
    await waitFor(() => expect(screen.getByText('custom value')).toBeInTheDocument());
  });

  it('shows searched options when typing', async () => {
    renderMetricSelect();
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'unique');
    await waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(3));
  });

  it('searches on split words', async () => {
    renderMetricSelect();
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'more unique');
    await waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(2));
  });

  it('searches on multiple split words', async () => {
    renderMetricSelect();
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'more unique metric');
    await waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(2));
  });

  it('highlights matching string', async () => {
    renderMetricSelect();
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'more');
    await waitFor(() => expect(document.querySelectorAll('mark')).toHaveLength(1));
  });

  it('highlights multiple matching strings in 1 input row', async () => {
    renderMetricSelect();
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'more metric');
    await waitFor(() => expect(document.querySelectorAll('mark')).toHaveLength(2));
  });

  it('highlights multiple matching strings in multiple input rows', async () => {
    renderMetricSelect();
    await openMetricSelect();
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'unique metric');
    await waitFor(() => expect(document.querySelectorAll('mark')).toHaveLength(4));
  });

  it('does not highlight matching string in create option', async () => {
    renderMetricSelect();
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

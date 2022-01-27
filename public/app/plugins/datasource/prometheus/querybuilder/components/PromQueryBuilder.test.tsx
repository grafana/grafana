import React from 'react';
import { render, screen, getByRole, getAllByRole } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromQueryBuilder } from './PromQueryBuilder';
import { PrometheusDatasource } from '../../datasource';
// import { QueryEditorMode } from '../shared/types';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import PromQlLanguageProvider from '../../language_provider';
import { PromVisualQuery } from '../types';

const defaultQuery: PromVisualQuery = {
  metric: 'random_metric',
  labels: [],
  operations: [],
};

describe('PromQueryBuilder', () => {
  it('shows empty just with metric selected', async () => {
    setup();
    // One should be select another query preview
    expect(screen.getAllByText('random_metric').length).toBe(2);
    // Add label
    expect(screen.getByLabelText('Add')).toBeInTheDocument();
    expect(screen.getByLabelText('Add operation')).toBeInTheDocument();
  });

  it('tries to load metrics without labels', async () => {
    const { languageProvider } = setup();
    openMetricSelect();
    expect(languageProvider.getLabelValues).toBeCalledWith('__name__');
  });

  it('tries to load metrics with labels', async () => {
    const { languageProvider } = setup({
      ...defaultQuery,
      labels: [{ label: 'label_name', op: '=', value: 'label_value' }],
    });
    openMetricSelect();
    expect(languageProvider.getSeries).toBeCalledWith('{label_name="label_value"}', true);
  });

  it('tries to load labels when metric selected', async () => {
    const { languageProvider } = setup();
    openLabelNameSelect();
    expect(languageProvider.fetchSeriesLabels).toBeCalledWith('{__name__="random_metric"}');
  });

  it('tries to load labels when metric selected and other labels are already present', async () => {
    const { languageProvider } = setup({
      ...defaultQuery,
      labels: [
        { label: 'label_name', op: '=', value: 'label_value' },
        { label: 'foo', op: '=', value: 'bar' },
      ],
    });
    openLabelNameSelect(1);
    expect(languageProvider.fetchSeriesLabels).toBeCalledWith('{label_name="label_value", __name__="random_metric"}');
  });

  it('tries to load labels when metric is not selected', async () => {
    const { languageProvider } = setup({
      ...defaultQuery,
      metric: '',
    });
    openLabelNameSelect();
    expect(languageProvider.fetchLabels).toBeCalled();
  });
});

function setup(query: PromVisualQuery = defaultQuery) {
  const languageProvider = (new EmptyLanguageProviderMock() as unknown) as PromQlLanguageProvider;
  const props = {
    datasource: new PrometheusDatasource(
      {
        url: '',
        jsonData: {},
        meta: {} as any,
      } as any,
      undefined,
      undefined,
      languageProvider
    ),
    onRunQuery: () => {},
    onChange: () => {},
  };

  render(<PromQueryBuilder {...props} query={query} />);
  return { languageProvider };
}

function getMetricSelect() {
  const metricSelect = screen.getAllByText('random_metric')[0].parentElement!;
  // We need to return specifically input element otherwise clicks don't seem to work
  return getByRole(metricSelect, 'combobox');
}

function openMetricSelect() {
  const select = getMetricSelect();
  userEvent.click(select);
}

function getLabelSelects(index = 0) {
  const labels = screen.getByText(/Labels/);
  const selects = getAllByRole(labels.parentElement!, 'combobox');
  return {
    name: selects[3 * index],
    value: selects[3 * index + 2],
  };
}

function openLabelNameSelect(index = 0) {
  const { name } = getLabelSelects(index);
  userEvent.click(name);
}

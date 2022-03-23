import React from 'react';
import { render, screen, getAllByRole, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LokiQueryBuilder } from './LokiQueryBuilder';
import { LokiDatasource } from '../../datasource';
import { LokiVisualQuery } from '../types';
import { PanelData } from '@grafana/data';

const defaultQuery: LokiVisualQuery = {
  labels: [{ op: '=', label: 'baz', value: 'bar' }],
  operations: [],
};

describe('LokiQueryBuilder', () => {
  it('tries to load labels when no labels are selected', async () => {
    const { datasource } = setup();
    datasource.languageProvider.fetchSeriesLabels = jest.fn().mockReturnValue({ job: ['a'], instance: ['b'] });
    userEvent.click(screen.getByLabelText('Add'));
    const labels = screen.getByText(/Labels/);
    const selects = getAllByRole(labels.parentElement!, 'combobox');
    userEvent.click(selects[3]);
    await waitFor(() => expect(screen.getByText('job')).toBeInTheDocument());
  });
});

function setup(query: LokiVisualQuery = defaultQuery, data?: PanelData) {
  const datasource = new LokiDatasource(
    {
      url: '',
      jsonData: {},
      meta: {} as any,
    } as any,
    undefined,
    undefined
  );
  const props = {
    datasource,
    onRunQuery: () => {},
    onChange: () => {},
    data,
  };

  const { container } = render(<LokiQueryBuilder {...props} query={query} />);
  return { datasource, container };
}

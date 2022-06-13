import { render, screen, getAllByRole, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { PanelData } from '@grafana/data';

import { LokiDatasource } from '../../datasource';
import { LokiOperationId, LokiVisualQuery } from '../types';

import { LokiQueryBuilder } from './LokiQueryBuilder';

const defaultQuery: LokiVisualQuery = {
  labels: [{ op: '=', label: 'baz', value: 'bar' }],
  operations: [],
};

describe('LokiQueryBuilder', () => {
  it('tries to load labels when no labels are selected', async () => {
    const { datasource } = setup();
    datasource.languageProvider.fetchSeriesLabels = jest.fn().mockReturnValue({ job: ['a'], instance: ['b'] });
    await userEvent.click(screen.getByLabelText('Add'));
    const labels = screen.getByText(/Labels/);
    const selects = getAllByRole(labels.parentElement!.parentElement!.parentElement!, 'combobox');
    await userEvent.click(selects[3]);
    await waitFor(() => expect(screen.getByText('job')).toBeInTheDocument());
  });

  it('shows error for query with operations and no stream selector', async () => {
    setup({ labels: [], operations: [{ id: LokiOperationId.Logfmt, params: [] }] });
    expect(screen.getByText('You need to specify at least 1 label filter (stream selector)')).toBeInTheDocument();
  });

  it('shows no error for query with empty __line_contains operation and no stream selector', async () => {
    setup({ labels: [], operations: [{ id: LokiOperationId.LineContains, params: [''] }] });
    expect(screen.queryByText('You need to specify at least 1 label filter (stream selector)')).not.toBeInTheDocument();
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

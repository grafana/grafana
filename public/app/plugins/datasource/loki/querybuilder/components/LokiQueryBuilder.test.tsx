import { render, screen, getAllByRole, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LokiDatasource } from '../../datasource';
import { LokiOperationId, LokiVisualQuery } from '../types';

import { LokiQueryBuilder } from './LokiQueryBuilder';

const defaultQuery: LokiVisualQuery = {
  labels: [{ op: '=', label: 'baz', value: 'bar' }],
  operations: [],
};

const createDefaultProps = () => {
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
  };

  return props;
};

describe('LokiQueryBuilder', () => {
  it('tries to load labels when no labels are selected', async () => {
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
    props.datasource.languageProvider.fetchSeriesLabels = jest.fn().mockReturnValue({ job: ['a'], instance: ['b'] });

    render(<LokiQueryBuilder {...props} query={defaultQuery} />);
    await userEvent.click(screen.getByLabelText('Add'));
    const labels = screen.getByText(/Labels/);
    const selects = getAllByRole(labels.parentElement!.parentElement!.parentElement!, 'combobox');
    await userEvent.click(selects[3]);
    await waitFor(() => expect(screen.getByText('job')).toBeInTheDocument());
  });

  it('shows error for query with operations and no stream selector', async () => {
    const query = { labels: [], operations: [{ id: LokiOperationId.Logfmt, params: [] }] };
    render(<LokiQueryBuilder {...createDefaultProps()} query={query} />);

    expect(
      await screen.findByText('You need to specify at least 1 label filter (stream selector)')
    ).toBeInTheDocument();
  });

  it('shows no error for query with empty __line_contains operation and no stream selector', async () => {
    const query = { labels: [], operations: [{ id: LokiOperationId.LineContains, params: [''] }] };
    render(<LokiQueryBuilder {...createDefaultProps()} query={query} />);

    await waitFor(() => {
      expect(
        screen.queryByText('You need to specify at least 1 label filter (stream selector)')
      ).not.toBeInTheDocument();
    });
  });
});

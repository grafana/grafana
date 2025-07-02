import { render, screen, waitFor, findAllByRole, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createLokiDatasource } from '../../mocks/datasource';

import { LokiQueryBuilderContainer } from './LokiQueryBuilderContainer';

describe('LokiQueryBuilderContainer', () => {
  it('translates query between string and model', async () => {
    const props = {
      query: {
        expr: '{job="testjob"}',
        refId: 'A',
      },
      datasource: createLokiDatasource(),
      onChange: jest.fn(),
      onRunQuery: () => {},
      showExplain: false,
    };
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    await act(async () => {
      render(<LokiQueryBuilderContainer {...props} />);
    });
    const selector = await screen.findByLabelText('selector');
    expect(selector.textContent).toBe('{job="testjob"}');
    await addOperation('Range functions', 'Rate');
    expect(await screen.findByText('Rate')).toBeInTheDocument();
    expect(props.onChange).toBeCalledWith({
      expr: 'rate({job="testjob"} [$__auto])',
      refId: 'A',
    });
  });
  it('uses | to separate multiple values in label filters', async () => {
    const props = {
      query: {
        expr: '{app="app1"}',
        refId: 'A',
      },
      datasource: createLokiDatasource(),
      onChange: jest.fn(),
      onRunQuery: () => {},
      showExplain: false,
    };
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
    props.datasource.languageProvider.fetchLabels = jest.fn().mockReturnValue(['job']);
    props.datasource.languageProvider.fetchLabelValues = jest.fn().mockReturnValue(['grafana', 'loki']);
    props.onChange = jest.fn();

    await act(async () => {
      render(<LokiQueryBuilderContainer {...props} />);
    });
    await userEvent.click(screen.getByLabelText('Add'));
    const labels = screen.getByText(/Label filters/);
    const selects = await findAllByRole(getSelectParent(labels)!, 'combobox');
    await userEvent.click(selects[3]);
    await userEvent.click(await screen.findByText('job'));

    await userEvent.click(selects[4]);
    await userEvent.click(await screen.findByText('=~'));

    await userEvent.click(selects[5]);
    await userEvent.click(await screen.findByText('grafana'));

    await userEvent.click(selects[5]);
    await userEvent.click(await screen.findByText('loki'));

    await waitFor(() => {
      expect(props.onChange).toBeCalledWith({ expr: '{app="app1", job=~"grafana|loki"}', refId: 'A' });
    });
  });

  it('highlights the query in preview using loki grammar', async () => {
    const props = {
      query: {
        expr: '{app="baz"} | logfmt',
        refId: 'A',
      },
      datasource: createLokiDatasource(),
      onChange: jest.fn(),
      onRunQuery: () => {},
      showExplain: false,
    };
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
    await act(async () => {
      render(<LokiQueryBuilderContainer {...props} />);
    });
    expect(screen.getByText('{')).toHaveClass('token punctuation');
    expect(screen.getByText('"baz"')).toHaveClass('token label-value attr-value');
    expect(screen.getByText('|')).toHaveClass('token pipe-operator operator');
    expect(screen.getByText('logfmt')).toHaveClass('token pipe-operations keyword');
  });

  it('shows conflicting label expressions', async () => {
    const props = {
      query: {
        expr: '{job="grafana"} | app!="bar" | app="bar"',
        refId: 'A',
      },
      datasource: createLokiDatasource(),
      onChange: jest.fn(),
      onRunQuery: () => {},
      showExplain: false,
    };
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    await act(async () => {
      render(<LokiQueryBuilderContainer {...props} />);
    });
    expect(screen.getAllByText('You have conflicting label filters')).toHaveLength(2);
  });

  it('uses <expr> as placeholder for query in explain section', async () => {
    const props = {
      query: {
        expr: '{job="grafana"} | logfmt',
        refId: 'A',
      },
      datasource: createLokiDatasource(),
      onChange: jest.fn(),
      onRunQuery: () => {},
      showExplain: true,
    };
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    await act(async () => {
      render(<LokiQueryBuilderContainer {...props} />);
    });
    expect(screen.getByText('<')).toBeInTheDocument();
    expect(screen.getByText('expr')).toBeInTheDocument();
    expect(screen.getByText('>')).toBeInTheDocument();
  });
});

async function addOperation(section: string, op: string) {
  const addOperationButton = screen.getByTitle('Add operation');
  expect(addOperationButton).toBeInTheDocument();
  await userEvent.click(addOperationButton);
  const sectionItem = await screen.findByTitle(section);
  expect(sectionItem).toBeInTheDocument();
  // Weirdly the await userEvent.click doesn't work here, it reports the item has pointer-events: none. Don't see that
  // anywhere when debugging so not sure what style is it picking up.
  await userEvent.click(sectionItem.children[0], { pointerEventsCheck: 0 });
  const opItem = screen.getByTitle(op);
  expect(opItem).toBeInTheDocument();
  // Weirdly the await userEvent.click doesn't work here, it reports the item has pointer-events: none. Don't see that
  // anywhere when debugging so not sure what style is it picking up.
  await userEvent.click(opItem, { pointerEventsCheck: 0 });
}

const getSelectParent = (input: HTMLElement) =>
  input.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;

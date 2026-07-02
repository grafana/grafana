import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type JaegerDatasource } from '../datasource';
import { type JaegerQuery } from '../types';

import { QueryEditor } from './QueryEditor';

jest.mock('./SearchForm', () => ({
  SearchForm: () => <div>SearchForm</div>,
}));

const defaultQuery: JaegerQuery = {
  refId: 'A',
  query: '',
};

function renderEditor(query: Partial<JaegerQuery> = {}) {
  const onChange = jest.fn();
  const onRunQuery = jest.fn();

  render(
    <QueryEditor
      datasource={{} as JaegerDatasource}
      query={{ ...defaultQuery, ...query }}
      onChange={onChange}
      onRunQuery={onRunQuery}
    />
  );

  return { onChange, onRunQuery };
}

describe('QueryEditor', () => {
  it('renders the trace ID editor with a placeholder by default', async () => {
    renderEditor();

    expect(await screen.findByText('Enter a Trace ID (run with Shift+Enter)')).toBeInTheDocument();
  });

  it('renders the current trace ID', async () => {
    renderEditor({ query: '6c6e5f478805e1c1' });

    expect(await screen.findByText('6c6e5f478805e1c1')).toBeInTheDocument();
  });

  it('renders the search form for the search query type', () => {
    renderEditor({ queryType: 'search' });

    expect(screen.getByText('SearchForm')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders no editor body for the dependency graph query type', () => {
    renderEditor({ queryType: 'dependencyGraph' });

    expect(screen.queryByText('SearchForm')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('propagates trace ID edits with a debounce', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('abc');

    // The update is debounced, so it must not fire on every keystroke.
    expect(onChange).not.toHaveBeenCalled();

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ ...defaultQuery, query: 'abc' }), { timeout: 2000 });
  });

  it('runs the query on Shift+Enter, flushing the pending edit first', async () => {
    const user = userEvent.setup();
    const { onChange, onRunQuery } = renderEditor();

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('abc');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onChange).toHaveBeenCalledWith({ ...defaultQuery, query: 'abc' });
    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });

  it('runs the query on blur when the trace ID changed', async () => {
    const user = userEvent.setup();
    const { onChange, onRunQuery } = renderEditor();

    const editor = await screen.findByRole('textbox');
    await user.click(editor);
    await user.keyboard('abc');
    fireEvent.blur(editor);

    expect(onChange).toHaveBeenCalledWith({ ...defaultQuery, query: 'abc' });
    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });

  it('does not run the query on blur when nothing changed', async () => {
    const user = userEvent.setup();
    const { onRunQuery } = renderEditor({ query: '6c6e5f478805e1c1' });

    const editor = await screen.findByRole('textbox');
    await user.click(editor);
    fireEvent.blur(editor);

    expect(onRunQuery).not.toHaveBeenCalled();
  });

  it('does not re-run the query on blur right after running it with Shift+Enter', async () => {
    const user = userEvent.setup();
    const { onRunQuery } = renderEditor();

    const editor = await screen.findByRole('textbox');
    await user.click(editor);
    await user.keyboard('abc');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    fireEvent.blur(editor);

    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });
});

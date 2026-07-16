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

  it('runs the query on Ctrl+Enter', async () => {
    const user = userEvent.setup();
    const { onRunQuery } = renderEditor({ query: '6c6e5f478805e1c1' });

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('{Control>}{Enter}{/Control}');

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

  it('drops a pending edit when the query type is switched externally', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const { rerender } = render(
      <QueryEditor
        datasource={{} as JaegerDatasource}
        query={{ ...defaultQuery }}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('abc');
    onChange.mockClear();

    // The query type switches externally (no blur fires when a focused element
    // is removed) before the debounce expires. Flushing the stale edit would
    // spread the old query object and revert the query type.
    rerender(
      <QueryEditor
        datasource={{} as JaegerDatasource}
        query={{ ...defaultQuery, queryType: 'search' }}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drops a pending edit when the trace ID is replaced externally', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const { rerender } = render(
      <QueryEditor
        datasource={{} as JaegerDatasource}
        query={{ ...defaultQuery }}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('abc');

    // The trace ID is replaced from outside before the debounce fires; the
    // stale local edit must not overwrite it.
    rerender(
      <QueryEditor
        datasource={{} as JaegerDatasource}
        query={{ ...defaultQuery, query: 'external' }}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );
    expect(await screen.findByText('external')).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(onChange).not.toHaveBeenCalledWith({ ...defaultQuery, query: 'abc' });
  });

  it('does not run the query on blur after an external trace ID change', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const { rerender } = render(
      <QueryEditor
        datasource={{} as JaegerDatasource}
        query={{ ...defaultQuery, query: 'aaa' }}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    // The trace ID changes from outside (e.g. a variable/URL update). This is
    // not a local edit, so a subsequent focus/blur must not re-run the query.
    rerender(
      <QueryEditor
        datasource={{} as JaegerDatasource}
        query={{ ...defaultQuery, query: 'bbb' }}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    const editor = await screen.findByRole('textbox');
    await user.click(editor);
    fireEvent.blur(editor);

    expect(onRunQuery).not.toHaveBeenCalled();
  });
});

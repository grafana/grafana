import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';

import { CodeEditor } from '../CodeMirror/CodeEditor';

import { getQueryFieldConfig, type QueryFieldConfigOptions } from './queryFieldConfig';

describe('getQueryFieldConfig', () => {
  const theme = createTheme();

  function renderField(options: QueryFieldConfigOptions = {}, value = '') {
    const onChange = jest.fn();
    const config = getQueryFieldConfig(theme, options);
    render(<CodeEditor value={value} onChange={onChange} height="auto" {...config} />);
    return { onChange };
  }

  it('renders the initial value', async () => {
    renderField({}, 'my.graphite.query');

    expect(await screen.findByText('my.graphite.query')).toBeInTheDocument();
  });

  it('shows the placeholder while the field is empty', async () => {
    renderField({ placeholder: 'Enter a query' });

    expect(await screen.findByText('Enter a query')).toBeInTheDocument();
  });

  it('propagates edits through onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderField();

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('abc');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('abc', expect.anything()));
  });

  it('runs the query on Shift+Enter', async () => {
    const user = userEvent.setup();
    const onRunQuery = jest.fn();
    renderField({ onRunQuery });

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });

  it('runs the query on Ctrl+Enter', async () => {
    const user = userEvent.setup();
    const onRunQuery = jest.fn();
    renderField({ onRunQuery });

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });

  it('inserts a newline on plain Enter instead of running the query', async () => {
    const user = userEvent.setup();
    const onRunQuery = jest.fn();
    const { onChange } = renderField({ onRunQuery });

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('{Enter}');

    expect(onRunQuery).not.toHaveBeenCalled();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('\n', expect.anything()));
  });

  it('calls onBlur when the editor loses focus', async () => {
    const user = userEvent.setup();
    const onBlur = jest.fn();
    renderField({ onBlur });

    const editor = await screen.findByRole('textbox');
    await user.click(editor);
    fireEvent.blur(editor);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('does not bind the run keymap when onRunQuery is not provided', async () => {
    const user = userEvent.setup();
    const { onChange } = renderField();

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    // With no run handler, Shift+Enter falls through to the default keymap and
    // inserts a newline.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('\n', expect.anything()));
  });
});

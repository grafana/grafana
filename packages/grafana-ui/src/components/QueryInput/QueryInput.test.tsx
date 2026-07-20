import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { QueryInput, type QueryInputProps } from './QueryInput';

describe('QueryInput', () => {
  function renderInput(props: Partial<QueryInputProps> = {}) {
    const onChange = jest.fn();
    const view = render(<QueryInput value="" onChange={onChange} {...props} />);

    return { ...view, onChange };
  }

  it('renders the current value', async () => {
    renderInput({ value: 'my.graphite.query' });

    expect(await screen.findByText('my.graphite.query')).toBeInTheDocument();
  });

  it('renders with the query field selector', () => {
    renderInput();

    expect(screen.getByTestId(selectors.components.QueryField.container)).toBeInTheDocument();
  });

  it('shows the placeholder while the value is empty', async () => {
    renderInput({ placeholder: 'Enter a query' });

    expect(await screen.findByText('Enter a query')).toBeInTheDocument();
  });

  it('propagates edits through onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderInput();

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('abc');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('abc', expect.anything()));
  });

  it.each([
    ['Shift+Enter', '{Shift>}{Enter}{/Shift}'],
    ['Ctrl+Enter', '{Control>}{Enter}{/Control}'],
  ])('runs the query on %s', async (_shortcut, keys) => {
    const user = userEvent.setup();
    const onRunQuery = jest.fn();
    renderInput({ onRunQuery });

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard(keys);

    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });

  it('inserts a newline on plain Enter instead of running the query', async () => {
    const user = userEvent.setup();
    const onRunQuery = jest.fn();
    const { onChange } = renderInput({ onRunQuery });

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('{Enter}');

    expect(onRunQuery).not.toHaveBeenCalled();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('\n', expect.anything()));
  });

  it('calls onBlur when the input loses focus', async () => {
    const user = userEvent.setup();
    const onBlur = jest.fn();
    renderInput({ onBlur });

    const input = await screen.findByRole('textbox');
    await user.click(input);
    fireEvent.blur(input);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('leaves Shift+Enter unbound when onRunQuery is not provided', async () => {
    const user = userEvent.setup();
    const { onChange } = renderInput();

    await user.click(await screen.findByRole('textbox'));
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('\n', expect.anything()));
  });

  it('applies accessible labels to the input', async () => {
    renderInput({ 'aria-label': 'Query', 'aria-labelledby': 'query-label' });

    const input = await screen.findByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Query');
    expect(input).toHaveAttribute('aria-labelledby', 'query-label');
  });
});

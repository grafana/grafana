import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NumberValueEditor, VarMappingNumberValueEditor } from './number';

jest.mock('app/core/components/SuggestionsInput/getVariableSuggestions', () => ({
  getVariableSuggestions: () => [
    { value: 't', label: 't', origin: 'template' },
    { value: 'other', label: 'other', origin: 'template' },
  ],
}));

const baseItem = {
  settings: {},
} as Parameters<typeof NumberValueEditor>[0]['item'];

describe('NumberValueEditor', () => {
  it('floors values when integer setting is enabled', () => {
    const onChange = jest.fn();
    render(
      <NumberValueEditor
        value={2}
        onChange={onChange}
        item={{ settings: { integer: true } } as typeof baseItem}
        context={{ data: [] }}
        id="n1"
      />
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.blur(input, { target: { value: '3.7' } });

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('passes through fractional values when integer is not set', () => {
    const onChange = jest.fn();
    render(<NumberValueEditor value={1} onChange={onChange} item={baseItem} context={{ data: [] }} id="n2" />);

    const input = screen.getByRole('spinbutton');
    fireEvent.blur(input, { target: { value: '3.25' } });

    expect(onChange).toHaveBeenCalledWith(3.25);
  });
});

describe('VarMappingNumberValueEditor', () => {
  const varItem = { settings: {} } as Parameters<typeof VarMappingNumberValueEditor>[0]['item'];

  it('renders a plain text input instead of a number spinbutton', () => {
    const onChange = jest.fn();
    render(<VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n4" />);

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('5');
  });

  it('surfaces $-containing text as a raw string via onChange instead of a parsed number', () => {
    const onChange = jest.fn();
    render(<VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n5" />);

    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: '$myVar' } });

    expect(onChange).toHaveBeenCalledWith('$myVar');
  });

  it('surfaces $-containing text on Enter too', () => {
    const onChange = jest.fn();
    render(
      <VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n5b" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '$myVar' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('$myVar');
  });

  it('still parses a plain number to a number', () => {
    const onChange = jest.fn();
    render(<VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n6" />);

    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: '42' } });

    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('floors a committed number when the integer setting is enabled', () => {
    const onChange = jest.fn();
    const integerVarItem = { settings: { integer: true } } as Parameters<typeof VarMappingNumberValueEditor>[0]['item'];
    render(
      <VarMappingNumberValueEditor value={5} onChange={onChange} item={integerVarItem} context={{ data: [] }} id="n7" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: '3.7' } });

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('shows the floored number when it equals the stored value', () => {
    const onChange = jest.fn();
    const integerVarItem = { settings: { integer: true } } as Parameters<typeof VarMappingNumberValueEditor>[0]['item'];
    render(
      <VarMappingNumberValueEditor
        value={3}
        onChange={onChange}
        item={integerVarItem}
        context={{ data: [] }}
        id="n7b"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '3.7' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(3);
    expect(input).toHaveValue('3');
  });

  it('clears the value (calls onChange with undefined) when the text is emptied', () => {
    const onChange = jest.fn();
    render(
      <VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n7b" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('does not call onChange when the text is neither a $ expression nor a valid number', () => {
    const onChange = jest.fn();
    render(<VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n8" />);

    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: 'not a number' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('displays a stored expression as text when the value is a string', () => {
    const onChange = jest.fn();
    render(
      <VarMappingNumberValueEditor value="$myVar" onChange={onChange} item={varItem} context={{ data: [] }} id="n9" />
    );

    expect(screen.getByRole('textbox')).toHaveValue('$myVar');
  });

  it('keeps a $ without a variable as typed, without storing it', () => {
    const onChange = jest.fn();
    render(
      <VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n10" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '$' } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('$');
  });

  it('rejects a number outside the range with the range in the message', () => {
    const onChange = jest.fn();
    const rangedItem = { settings: { min: 0, max: 10 } } as Parameters<typeof VarMappingNumberValueEditor>[0]['item'];
    render(
      <VarMappingNumberValueEditor value={5} onChange={onChange} item={rangedItem} context={{ data: [] }} id="n11" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: '50' } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Out of range. Range: 0 to 10')).toBeInTheDocument();

    fireEvent.blur(input, { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith(7);
    expect(screen.queryByText(/Out of range/)).not.toBeInTheDocument();
  });

  it('describes the input with the range, or with the error while it is shown', () => {
    const rangedItem = { settings: { min: 0, max: 10 } } as Parameters<typeof VarMappingNumberValueEditor>[0]['item'];
    render(
      <VarMappingNumberValueEditor value={5} onChange={jest.fn()} item={rangedItem} context={{ data: [] }} id="n14" />
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAccessibleDescription('Range: 0 to 10');

    fireEvent.blur(input, { target: { value: '50' } });
    expect(input).toHaveAccessibleDescription('Out of range. Range: 0 to 10');
  });

  it('clears the range error while typing', () => {
    const rangedItem = { settings: { min: 0, max: 10 } } as Parameters<typeof VarMappingNumberValueEditor>[0]['item'];
    render(
      <VarMappingNumberValueEditor value={5} onChange={jest.fn()} item={rangedItem} context={{ data: [] }} id="n15" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: '50' } });
    fireEvent.change(input, { target: { value: '7' } });

    expect(screen.queryByText(/Out of range/)).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('commits once for Enter followed by blur', () => {
    const onChange = jest.fn();
    render(
      <VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n12" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '$myVar' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('treats [[var]] as an expression', () => {
    const onChange = jest.fn();
    render(
      <VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n13" />
    );

    fireEvent.blur(screen.getByRole('textbox'), { target: { value: '[[myVar]]' } });

    expect(onChange).toHaveBeenCalledWith('[[myVar]]');
  });

  it('lists dashboard variables on $ and writes the picked one as ${name}', async () => {
    const onChange = jest.fn();
    render(
      <VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n20" />
    );

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '$');
    await userEvent.click(await screen.findByText('t'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('${t}');
    expect(screen.getByRole('textbox')).toHaveValue('${t}');
  });

  it('opens the variable list with Ctrl+Space and picks with the keyboard', async () => {
    const onChange = jest.fn();
    render(<VarMappingNumberValueEditor value="" onChange={onChange} item={varItem} context={{ data: [] }} id="n21" />);

    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('{Control>} {/Control}');
    expect(await screen.findByText('other')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenLastCalledWith('${other}');
  });

  it('shows a value that changes from outside, and reverts text that is not a number', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <VarMappingNumberValueEditor value={5} onChange={onChange} item={varItem} context={{ data: [] }} id="n22" />
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByRole('textbox')).toHaveValue('5');

    rerender(
      <VarMappingNumberValueEditor value={7} onChange={onChange} item={varItem} context={{ data: [] }} id="n22" />
    );
    expect(screen.getByRole('textbox')).toHaveValue('7');
  });
});

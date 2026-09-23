import { render, screen, fireEvent } from '@testing-library/react';

import { NumberValueEditor, VarMappingNumberValueEditor } from './number';

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
});

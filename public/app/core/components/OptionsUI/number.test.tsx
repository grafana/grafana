import { render, screen, fireEvent } from '@testing-library/react';

import { NumberValueEditor } from './number';

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

describe('NumberValueEditor with allowVariables', () => {
  const itemWithVariables = { settings: { allowVariables: true } } as typeof baseItem;

  it('renders a text input instead of a number input', () => {
    render(
      <NumberValueEditor value={5} onChange={jest.fn()} item={itemWithVariables} context={{ data: [] }} id="n3" />
    );

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('5');
  });

  it('emits a string when the value contains a variable expression', () => {
    const onChange = jest.fn();
    render(
      <NumberValueEditor value={5} onChange={onChange} item={itemWithVariables} context={{ data: [] }} id="n4" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '$myVar' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith('$myVar');
  });

  it('emits a number for plain numeric entry', () => {
    const onChange = jest.fn();
    render(
      <NumberValueEditor value={5} onChange={onChange} item={itemWithVariables} context={{ data: [] }} id="n5" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '42.5' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(42.5);
  });

  it('floors numeric entry when integer is set', () => {
    const onChange = jest.fn();
    render(
      <NumberValueEditor
        value={5}
        onChange={onChange}
        item={{ settings: { allowVariables: true, integer: true } } as typeof baseItem}
        context={{ data: [] }}
        id="n6"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '3.7' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('emits undefined when cleared', () => {
    const onChange = jest.fn();
    render(
      <NumberValueEditor value={5} onChange={onChange} item={itemWithVariables} context={{ data: [] }} id="n7" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('does not emit for non-numeric entry without a variable', () => {
    const onChange = jest.fn();
    render(
      <NumberValueEditor value={5} onChange={onChange} item={itemWithVariables} context={{ data: [] }} id="n8" />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps number entry as spinbutton when allowVariables is not set', () => {
    const onChange = jest.fn();
    render(<NumberValueEditor value={5} onChange={onChange} item={baseItem} context={{ data: [] }} id="n9" />);

    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

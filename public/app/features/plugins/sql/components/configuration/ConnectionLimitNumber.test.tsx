import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { NumberInput } from './ConnectionLimitNumber';

const setup = () => {
  const onChange = jest.fn();
  render(<NumberInput value={42} onChange={onChange} />);
  return {
    input: screen.getByRole('spinbutton'),
    onChange,
  };
};

describe('NumberInput', () => {
  it('calls onChange when a number is entered', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: '55' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(55);
  });

  it('does not call onChange for empty-string', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledTimes(0);
  });

  it('does not call onChange for all-spaces-string', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: '    ' } });
    expect(onChange).toHaveBeenCalledTimes(0);
  });

  it('does not call onChange when a non-number is entered', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: 'not-a-number' } });
    expect(onChange).toHaveBeenCalledTimes(0);
  });
});

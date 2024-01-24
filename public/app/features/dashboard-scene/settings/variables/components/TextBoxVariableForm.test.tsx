import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { TextBoxVariableForm } from './TextBoxVariableForm';

describe('TextBoxVariableForm', () => {
  it('renders correctly', () => {
    const onChange = jest.fn();
    const onBlur = jest.fn();
    const value = 'test value';

    render(<TextBoxVariableForm value={value} onChange={onChange} onBlur={onBlur} />);

    expect(screen.getByText('Text options')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Default value' })).toBeInTheDocument();
  });

  it('calls onChange when input value changes', async () => {
    const onChange = jest.fn();
    const onBlur = jest.fn();
    const value = 'test value';

    render(<TextBoxVariableForm value={value} onChange={onChange} onBlur={onBlur} />);

    const input = screen.getByRole('textbox', { name: 'Default value' });
    expect(input).toHaveValue(value);

    // change input value
    const newValue = 'new value';
    await userEvent.type(input, newValue);
    expect(onChange).toHaveBeenCalledTimes(newValue.length);
  });
});

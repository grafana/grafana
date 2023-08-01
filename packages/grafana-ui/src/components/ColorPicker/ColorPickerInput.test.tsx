import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ColorPickerInput } from './ColorPickerInput';

const noop = () => {};
describe('ColorPickerInput', () => {
  it('should show color popover on focus', async () => {
    render(<ColorPickerInput onChange={noop} />);
    expect(screen.queryByTestId('color-popover')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('textbox'));
    expect(screen.getByTestId('color-popover')).toBeInTheDocument();
  });

  it('should pass correct color to onChange callback', async () => {
    const mockOnChange = jest.fn();
    render(<ColorPickerInput onChange={mockOnChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'rgb(255,255,255)');
    await waitFor(() => expect(mockOnChange).toHaveBeenCalledWith('rgb(255, 255, 255)'));
  });

  it('should not pass invalid color value to onChange callback', async () => {
    const mockOnChange = jest.fn();
    render(<ColorPickerInput onChange={mockOnChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'some text');
    // blur the input
    await userEvent.click(document.body);
    await waitFor(() => expect(mockOnChange).not.toHaveBeenCalled());
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('should be able to reset selected value', async () => {
    const mockOnChange = jest.fn();
    render(<ColorPickerInput onChange={mockOnChange} value={'rgb(0,0,0)'} />);
    // Should show the value in the input
    expect(screen.getByDisplayValue('rgb(0,0,0)')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('textbox'));
    await waitFor(() => expect(mockOnChange).toHaveBeenCalledWith(''));
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});

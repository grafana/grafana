import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { dateTimeFormat } from '@grafana/data';

import { DatePickerWithInput } from './DatePickerWithInput';

describe('DatePickerWithInput', () => {
  it('renders date input', () => {
    render(<DatePickerWithInput onChange={jest.fn()} value={new Date(1400000000000)} />);

    expect(screen.getByDisplayValue(dateTimeFormat(1400000000000, { format: 'L' }))).toBeInTheDocument();
  });

  it('renders date input with date passed in', () => {
    render(<DatePickerWithInput value={new Date(1607431703363)} onChange={jest.fn()} />);

    expect(screen.getByDisplayValue(dateTimeFormat(1607431703363, { format: 'L' }))).toBeInTheDocument();
  });

  it('does not render calendar', () => {
    render(<DatePickerWithInput onChange={jest.fn()} />);

    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
  });

  describe('input is clicked', () => {
    it('renders input', () => {
      render(<DatePickerWithInput onChange={jest.fn()} />);

      fireEvent.click(screen.getByPlaceholderText('Date'));

      expect(screen.getByPlaceholderText('Date')).toBeInTheDocument();
    });

    it('renders calendar', () => {
      render(<DatePickerWithInput onChange={jest.fn()} />);

      fireEvent.click(screen.getByPlaceholderText('Date'));

      expect(screen.queryByTestId('date-picker')).toBeInTheDocument();
    });
  });

  it('calls onChange after date is selected', () => {
    const onChange = jest.fn();
    render(<DatePickerWithInput onChange={onChange} />);

    // open calendar and select a date
    fireEvent.click(screen.getByPlaceholderText('Date'));
    fireEvent.click(screen.getByText('14'));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('closes calendar after outside wrapper is clicked', () => {
    render(<DatePickerWithInput onChange={jest.fn()} />);

    // open calendar and click outside
    fireEvent.click(screen.getByPlaceholderText('Date'));

    expect(screen.getByTestId('date-picker')).toBeInTheDocument();

    fireEvent.click(document);

    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
  });
});

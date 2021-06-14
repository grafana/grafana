import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DatePickerWithInput } from './DatePickerWithInput';
import MockDate from 'mockdate';

describe('DatePickerWithInput', () => {
  beforeEach(() => {
    const mockDate = new Date(1400000000000);
    MockDate.set(mockDate);
  });

  afterEach(() => {
    MockDate.reset();
  });

  it('renders date input', () => {
    render(<DatePickerWithInput onChange={jest.fn()} />);

    expect(screen.getByDisplayValue('2014-05-13')).toBeInTheDocument();
  });

  it('renders date input with date passed in', () => {
    // reset the date so we can use it for the date conversion here
    MockDate.reset();

    render(<DatePickerWithInput value={new Date(1607431703363)} onChange={jest.fn()} />);

    expect(screen.getByDisplayValue('2020-12-08')).toBeInTheDocument();
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

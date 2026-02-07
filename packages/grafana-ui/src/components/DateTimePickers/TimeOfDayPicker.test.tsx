import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime, dateTimeForTimeZone } from '@grafana/data';

import { TimeOfDayPicker } from './TimeOfDayPicker';

describe('TimeOfDayPicker', () => {
  it('renders correctly with a value', () => {
    const onChange = jest.fn();
    const value = dateTime(Date.now());

    render(<TimeOfDayPicker onChange={onChange} value={value} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).not.toHaveValue('');
  });

  it('renders without a value when allowEmpty is true', () => {
    const onChange = jest.fn();

    render(<TimeOfDayPicker onChange={onChange} allowEmpty={true} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('calls onChange with undefined when value is cleared and allowEmpty is true', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const value = dateTime('2025-06-15 14:30:00');

    render(<TimeOfDayPicker onChange={onChange} value={value} allowEmpty={true} />);

    const clearButton = screen.getByRole('button');
    await user.click(clearButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('is disabled when disabled prop is true', () => {
    const onChange = jest.fn();
    const value = dateTime(Date.now());

    render(<TimeOfDayPicker onChange={onChange} value={value} disabled={true} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('calls onChange when user types a valid time', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const value = dateTime(Date.now());

    render(<TimeOfDayPicker onChange={onChange} value={value} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '14:30');
    await user.tab(); // blur to trigger change

    expect(onChange).toHaveBeenCalled();
    const newValue = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(newValue).toBeDefined();
    expect(newValue.hour()).toBe(14);
    expect(newValue.minute()).toBe(30);
  });

  it('preserves timezone when displaying value', () => {
    const onChange = jest.fn();
    const value = dateTimeForTimeZone('Asia/Tokyo', '2025-06-15 09:30:00');

    render(<TimeOfDayPicker onChange={onChange} value={value} />);

    // Should display the timezone-aware hour/minute, not the browser-local time
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('09:30');
  });

  it('preserves timezone on onChange', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const value = dateTimeForTimeZone('Asia/Tokyo', '2025-06-15 09:30:00');

    render(<TimeOfDayPicker onChange={onChange} value={value} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '16:45');
    await user.tab();

    expect(onChange).toHaveBeenCalled();
    const result = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(result.hour()).toBe(16);
    expect(result.minute()).toBe(45);
  });
});


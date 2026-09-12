import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTimeFormat } from '@grafana/data';

import { DatePickerWithInput } from './DatePickerWithInput';

describe('DatePickerWithInput', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup({ applyAccept: false });
  });

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

    expect(screen.getByPlaceholderText('Date')).toBeInTheDocument();
    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
  });

  describe('input is clicked', () => {
    it('renders input', async () => {
      render(<DatePickerWithInput onChange={jest.fn()} />);
      await user.click(screen.getByPlaceholderText('Date'));

      expect(screen.getByPlaceholderText('Date')).toBeInTheDocument();
      expect(await screen.findByText('14')).toBeInTheDocument();
    });

    it('renders calendar', async () => {
      render(<DatePickerWithInput onChange={jest.fn()} />);

      await user.click(screen.getByPlaceholderText('Date'));

      expect(await screen.findByText('14')).toBeInTheDocument();
    });
  });

  it.each([false, true])('selects a date with closeOnSelect=%s', async (closeOnSelect) => {
    const onChange = jest.fn();
    render(<DatePickerWithInput value={new Date(2020, 11, 8)} onChange={onChange} closeOnSelect={closeOnSelect} />);

    // open calendar and select a date
    await user.click(screen.getByPlaceholderText('Date'));
    await user.click(await screen.findByRole('button', { name: 'December 14, 2020' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(new Date(2020, 11, 14));
    if (closeOnSelect) {
      expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole('button', { name: 'December 14, 2020' })).toBeInTheDocument();
    }
  });

  it('closes calendar after outside wrapper is clicked', async () => {
    render(<DatePickerWithInput onChange={jest.fn()} />);

    // open calendar and click outside
    await user.click(screen.getByPlaceholderText('Date'));

    expect(await screen.findByText('14')).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
  });
});

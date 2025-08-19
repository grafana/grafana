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

    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
  });

  describe('input is clicked', () => {
    it('renders input', async () => {
      render(<DatePickerWithInput onChange={jest.fn()} />);
      await user.click(screen.getByPlaceholderText('Date'));

      expect(screen.getByPlaceholderText('Date')).toBeInTheDocument();
    });

    it('renders calendar', async () => {
      render(<DatePickerWithInput onChange={jest.fn()} />);

      await user.click(screen.getByPlaceholderText('Date'));

      expect(screen.getByTestId('date-picker')).toBeInTheDocument();
    });
  });

  it('calls onChange after date is selected', async () => {
    const onChange = jest.fn();
    render(<DatePickerWithInput onChange={onChange} />);

    // open calendar and select a date
    await user.click(screen.getByPlaceholderText('Date'));
    await user.click(screen.getByText('14'));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('closes calendar after outside wrapper is clicked', async () => {
    render(<DatePickerWithInput onChange={jest.fn()} />);

    // open calendar and click outside
    await user.click(screen.getByPlaceholderText('Date'));

    expect(screen.getByTestId('date-picker')).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('does not render calendar when isOpen is false', () => {
    render(<DatePicker isOpen={false} onChange={jest.fn()} onClose={jest.fn()} />);

    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
  });

  it('renders calendar when isOpen is true', async () => {
    render(<DatePicker isOpen={true} onChange={jest.fn()} onClose={jest.fn()} />);

    expect(await screen.findByText('14')).toBeInTheDocument();
  });

  it('renders calendar with default date', async () => {
    render(<DatePicker isOpen={true} onChange={jest.fn()} onClose={jest.fn()} value={new Date(1400000000000)} />);

    expect(await screen.findByText('May 2014')).toBeInTheDocument();
  });

  it('renders calendar with date passed in', async () => {
    render(<DatePicker isOpen={true} value={new Date(1607431703363)} onChange={jest.fn()} onClose={jest.fn()} />);

    expect(await screen.findByText('December 2020')).toBeInTheDocument();
  });

  it('exposes the selected state of the selected date', async () => {
    render(<DatePicker isOpen={true} value={new Date(1607431703363)} onChange={jest.fn()} onClose={jest.fn()} />);

    expect(await screen.findByRole('button', { name: 'December 8, 2020', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'December 9, 2020', pressed: false })).toBeInTheDocument();
  });

  it('calls onChange when date is selected', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<DatePicker isOpen={true} onChange={onChange} onClose={jest.fn()} />);

    const day = await screen.findByText('14');
    expect(onChange).not.toHaveBeenCalled();

    // clicking the date
    await user.click(day);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('uses the latest value, date limits, and onChange callback', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const latestOnChange = jest.fn();
    const onClose = jest.fn();
    const { rerender } = render(
      <DatePicker isOpen={true} value={new Date(2020, 11, 8)} onChange={onChange} onClose={onClose} />
    );

    rerender(
      <DatePicker
        isOpen={true}
        value={new Date(2020, 11, 15)}
        minDate={new Date(2020, 11, 14)}
        maxDate={new Date(2020, 11, 16)}
        onChange={latestOnChange}
        onClose={onClose}
      />
    );

    expect(await screen.findByRole('button', { name: 'December 15, 2020', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'December 13, 2020' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'December 17, 2020' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'December 16, 2020' }));

    expect(latestOnChange).toHaveBeenCalledWith(new Date(2020, 11, 16));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onClose when outside of wrapper is clicked', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(<DatePicker isOpen={true} onChange={jest.fn()} onClose={onClose} />);

    expect(await screen.findByText('14')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

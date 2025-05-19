import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('does not render calendar when isOpen is false', () => {
    render(<DatePicker isOpen={false} onChange={jest.fn()} onClose={jest.fn()} />);

    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
  });

  it('renders calendar when isOpen is true', () => {
    render(<DatePicker isOpen={true} onChange={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByTestId('date-picker')).toBeInTheDocument();
  });

  it('renders calendar with default date', () => {
    render(<DatePicker isOpen={true} onChange={jest.fn()} onClose={jest.fn()} value={new Date(1400000000000)} />);

    expect(screen.getByText('May 2014')).toBeInTheDocument();
  });

  it('renders calendar with date passed in', () => {
    render(<DatePicker isOpen={true} value={new Date(1607431703363)} onChange={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByText('December 2020')).toBeInTheDocument();
  });

  it('calls onChange when date is selected', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<DatePicker isOpen={true} onChange={onChange} onClose={jest.fn()} />);

    expect(onChange).not.toHaveBeenCalled();

    // clicking the date
    await user.click(screen.getByText('14'));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when outside of wrapper is clicked', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(<DatePicker isOpen={true} onChange={jest.fn()} onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();

    await user.click(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

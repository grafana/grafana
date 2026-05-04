import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AlertQueryOptions, MaxDataPointsOption, MinIntervalOption } from './QueryWrapper';

describe('MaxDataPointsOption', () => {
  it('should commit the value on blur', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const options: AlertQueryOptions = { maxDataPoints: undefined, minInterval: undefined };

    render(<MaxDataPointsOption options={options} onChange={onChange} />);

    const input = screen.getByRole('spinbutton');
    await user.click(input);
    await user.type(input, '1000');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ ...options, maxDataPoints: 1000 });
  });

  it('should commit the value on unmount when blur has not fired', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const options: AlertQueryOptions = { maxDataPoints: undefined, minInterval: undefined };

    const { unmount } = render(<MaxDataPointsOption options={options} onChange={onChange} />);

    const input = screen.getByRole('spinbutton');
    await user.click(input);
    await user.type(input, '500');

    // Unmount without blurring — simulates Toggletip closing
    unmount();

    expect(onChange).toHaveBeenCalledWith({ ...options, maxDataPoints: 500 });
  });

  it('should not call onChange on unmount if value has not changed', () => {
    const onChange = jest.fn();
    const options: AlertQueryOptions = { maxDataPoints: 1000, minInterval: undefined };

    const { unmount } = render(<MaxDataPointsOption options={options} onChange={onChange} />);

    unmount();

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('MinIntervalOption', () => {
  it('should commit the value on blur', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const options: AlertQueryOptions = { maxDataPoints: undefined, minInterval: undefined };

    render(<MinIntervalOption options={options} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, '15s');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ ...options, minInterval: '15s' });
  });

  it('should commit the value on unmount when blur has not fired', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const options: AlertQueryOptions = { maxDataPoints: undefined, minInterval: undefined };

    const { unmount } = render(<MinIntervalOption options={options} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, '30s');

    // Unmount without blurring — simulates Toggletip closing
    unmount();

    expect(onChange).toHaveBeenCalledWith({ ...options, minInterval: '30s' });
  });

  it('should not call onChange on unmount if value has not changed', () => {
    const onChange = jest.fn();
    const options: AlertQueryOptions = { maxDataPoints: undefined, minInterval: '10s' };

    const { unmount } = render(<MinIntervalOption options={options} onChange={onChange} />);

    unmount();

    expect(onChange).not.toHaveBeenCalled();
  });
});

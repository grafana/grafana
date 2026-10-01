import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AlertQuery } from 'app/types/unified-alerting-dto';

import { QueryOptions } from './QueryOptions';

describe('QueryOptions', () => {
  const defaultQuery: AlertQuery = {
    refId: 'A',
    queryType: '',
    datasourceUid: 'ds-1',
    model: {
      refId: 'A',
    },
  };

  const setup = async (overrides?: { maxDataPoints?: number; minInterval?: string }) => {
    const user = userEvent.setup();
    const onChangeQueryOptions = jest.fn();
    const queryOptions = {
      maxDataPoints: overrides?.maxDataPoints ?? 100,
      minInterval: overrides?.minInterval ?? '1m',
    };

    render(
      <QueryOptions
        query={defaultQuery}
        queryOptions={queryOptions}
        onChangeQueryOptions={onChangeQueryOptions}
        index={0}
      />
    );

    const button = screen.getByRole('button', { name: /Options/i });
    await user.click(button);

    const maxDataPointsInput = screen.getByRole('spinbutton', { name: /Max data points/i });
    const minIntervalInput = screen.getByRole('textbox', { name: /Interval/i });
    const applyButton = screen.getByRole('button', { name: /Apply/i });

    return { user, onChangeQueryOptions, maxDataPointsInput, minIntervalInput, applyButton };
  };

  it('should persist values only when Apply is clicked', async () => {
    const { user, onChangeQueryOptions, maxDataPointsInput, minIntervalInput, applyButton } = await setup();

    await user.clear(maxDataPointsInput);
    await user.type(maxDataPointsInput, '200');
    await user.clear(minIntervalInput);
    await user.type(minIntervalInput, '5m');
    expect(onChangeQueryOptions).not.toHaveBeenCalled();

    await user.click(applyButton);

    expect(onChangeQueryOptions).toHaveBeenCalledTimes(1);
    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 200, minInterval: '5m' }, 0);
  });

  it('should discard edits and reset inputs when tooltip is closed without Apply', async () => {
    const { user, onChangeQueryOptions, maxDataPointsInput } = await setup();

    await user.clear(maxDataPointsInput);
    await user.type(maxDataPointsInput, '200');

    const closeButton = screen.getByTestId('toggletip-header-close');
    await user.click(closeButton);
    expect(onChangeQueryOptions).not.toHaveBeenCalled();

    const optionsButton = screen.getByRole('button', { name: /Options/i });
    await user.click(optionsButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    await user.click(applyButton);

    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 100, minInterval: '1m' }, 0);
  });

  it('should treat zero maxDataPoints as cleared', async () => {
    const { user, onChangeQueryOptions, maxDataPointsInput, applyButton } = await setup();

    await user.clear(maxDataPointsInput);
    await user.type(maxDataPointsInput, '0');
    await user.click(applyButton);

    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: undefined, minInterval: '1m' }, 0);
  });

  it('should block save and show error for invalid interval', async () => {
    const { user, onChangeQueryOptions, minIntervalInput, applyButton } = await setup();

    await user.clear(minIntervalInput);
    await user.type(minIntervalInput, 'abc');
    await user.click(applyButton);

    expect(onChangeQueryOptions).not.toHaveBeenCalled();
    expect(screen.getByText(/Invalid interval format/i)).toBeInTheDocument();
  });

  it('should clear interval error when user edits the field', async () => {
    const { user, onChangeQueryOptions, minIntervalInput, applyButton } = await setup();

    await user.clear(minIntervalInput);
    await user.type(minIntervalInput, 'abc');
    await user.click(applyButton);
    expect(screen.getByText(/Invalid interval format/i)).toBeInTheDocument();

    await user.clear(minIntervalInput);
    await user.type(minIntervalInput, '5m');
    expect(screen.queryByText(/Invalid interval format/i)).not.toBeInTheDocument();

    await user.click(applyButton);
    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 100, minInterval: '5m' }, 0);
  });

  it('should sync local state when external props change', async () => {
    const user = userEvent.setup();
    const onChangeQueryOptions = jest.fn();

    const { rerender } = render(
      <QueryOptions
        query={defaultQuery}
        queryOptions={{ maxDataPoints: 100, minInterval: '1m' }}
        onChangeQueryOptions={onChangeQueryOptions}
        index={0}
      />
    );

    const button = screen.getByRole('button', { name: /Options/i });
    await user.click(button);

    const maxDataPointsInput = screen.getByRole('spinbutton', { name: /Max data points/i });
    await user.clear(maxDataPointsInput);
    await user.type(maxDataPointsInput, '999');
    expect(maxDataPointsInput).toHaveValue(999);

    rerender(
      <QueryOptions
        query={defaultQuery}
        queryOptions={{ maxDataPoints: 500, minInterval: '10s' }}
        onChangeQueryOptions={onChangeQueryOptions}
        index={0}
      />
    );

    expect(maxDataPointsInput).toHaveValue(500);
  });
});

import { render, screen, fireEvent } from '@testing-library/react';

import { getDefaultRelativeTimeRange } from '@grafana/data';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { QueryOptions } from './QueryOptions';

describe('QueryOptions', () => {
  const defaultQuery: AlertQuery = {
    refId: 'A',
    model: {
      refId: 'A',
    },
  };

  const setup = (overrides?: { maxDataPoints?: number; minInterval?: string }) => {
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
    fireEvent.click(button);

    const maxDataPointsInput = screen.getByRole('spinbutton', { name: /Max data points/i });
    const minIntervalInput = screen.getByRole('textbox', { name: /Interval/i });
    const applyButton = screen.getByRole('button', { name: /Apply/i });

    return { onChangeQueryOptions, maxDataPointsInput, minIntervalInput, applyButton };
  };

  it('should persist values only when Apply is clicked', () => {
    const { onChangeQueryOptions, maxDataPointsInput, minIntervalInput, applyButton } = setup();

    fireEvent.change(maxDataPointsInput, { target: { value: '200' } });
    fireEvent.change(minIntervalInput, { target: { value: '5m' } });
    expect(onChangeQueryOptions).not.toHaveBeenCalled();

    fireEvent.click(applyButton);

    expect(onChangeQueryOptions).toHaveBeenCalledTimes(1);
    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 200, minInterval: '5m' }, 0);
  });

  it('should discard edits and reset inputs when tooltip is closed without Apply', () => {
    const { onChangeQueryOptions, maxDataPointsInput } = setup();

    fireEvent.change(maxDataPointsInput, { target: { value: '200' } });

    const closeButton = screen.getByTestId('toggletip-header-close');
    fireEvent.click(closeButton);
    expect(onChangeQueryOptions).not.toHaveBeenCalled();

    const optionsButton = screen.getByRole('button', { name: /Options/i });
    fireEvent.click(optionsButton);

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 100, minInterval: '1m' }, 0);
  });

  it('should treat zero maxDataPoints as cleared', () => {
    const { onChangeQueryOptions, maxDataPointsInput, applyButton } = setup();

    fireEvent.change(maxDataPointsInput, { target: { value: '0' } });
    fireEvent.click(applyButton);

    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: undefined, minInterval: '1m' }, 0);
  });

  it('should block save and show error for invalid interval', () => {
    const { onChangeQueryOptions, minIntervalInput, applyButton } = setup();

    fireEvent.change(minIntervalInput, { target: { value: 'abc' } });
    fireEvent.click(applyButton);

    expect(onChangeQueryOptions).not.toHaveBeenCalled();
    expect(screen.getByText(/Invalid interval format/i)).toBeInTheDocument();
  });

  it('should clear interval error when user edits the field', () => {
    const { onChangeQueryOptions, minIntervalInput, applyButton } = setup();

    fireEvent.change(minIntervalInput, { target: { value: 'abc' } });
    fireEvent.click(applyButton);
    expect(screen.getByText(/Invalid interval format/i)).toBeInTheDocument();

    fireEvent.change(minIntervalInput, { target: { value: '5m' } });
    expect(screen.queryByText(/Invalid interval format/i)).not.toBeInTheDocument();

    fireEvent.click(applyButton);
    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 100, minInterval: '5m' }, 0);
  });

  it('should sync local state when external props change', () => {
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
    fireEvent.click(button);

    const maxDataPointsInput = screen.getByRole('spinbutton', { name: /Max data points/i });
    fireEvent.change(maxDataPointsInput, { target: { value: '999' } });
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

  it('should persist interval edit after time range change', () => {
    const onChangeQueryOptions = jest.fn();
    const onChangeTimeRange = jest.fn();
    const initialTimeRange = getDefaultRelativeTimeRange();

    const { rerender } = render(
      <QueryOptions
        query={{ ...defaultQuery, relativeTimeRange: initialTimeRange }}
        queryOptions={{ maxDataPoints: 100, minInterval: '1m' }}
        onChangeQueryOptions={onChangeQueryOptions}
        onChangeTimeRange={onChangeTimeRange}
        index={0}
      />
    );

    const button = screen.getByRole('button', { name: /Options/i });
    fireEvent.click(button);

    const minIntervalInput = screen.getByRole('textbox', { name: /Interval/i });
    fireEvent.change(minIntervalInput, { target: { value: '10s' } });

    const newTimeRange = { from: 3600, to: 0 };
    rerender(
      <QueryOptions
        query={{ ...defaultQuery, relativeTimeRange: newTimeRange }}
        queryOptions={{ maxDataPoints: 100, minInterval: '1m' }}
        onChangeQueryOptions={onChangeQueryOptions}
        onChangeTimeRange={onChangeTimeRange}
        index={0}
      />
    );

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 100, minInterval: '10s' }, 0);
  });
});

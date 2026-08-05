import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryOptions } from './QueryOptions';
import { AlertQuery } from 'app/types/unified-alerting-dto';

describe('QueryOptions', () => {
  const defaultQuery: AlertQuery = {
    refId: 'A',
    model: {
      refId: 'A',
    },
  };

  const setup = () => {
    const onChangeQueryOptions = jest.fn();
    const queryOptions = { maxDataPoints: 100, minInterval: '1m' };

    render(
      <QueryOptions
        query={defaultQuery}
        queryOptions={queryOptions}
        onChangeQueryOptions={onChangeQueryOptions}
        index={0}
      />
    );

    // Open the toggletip
    const button = screen.getByRole('button', { name: /Options/i });
    fireEvent.click(button);

    const maxDataPointsInput = screen.getByRole('spinbutton', { name: /Max data points/i });
    const minIntervalInput = screen.getByRole('textbox', { name: /Interval/i });
    const closeButton = screen.getByTestId('toggletip-header-close');

    return { onChangeQueryOptions, maxDataPointsInput, minIntervalInput, closeButton };
  };

  it('should call onChangeQueryOptions with updated maxDataPoints and minInterval on close', () => {
    const { onChangeQueryOptions, maxDataPointsInput, minIntervalInput, closeButton } = setup();

    // Simulate user typing a new value
    fireEvent.change(maxDataPointsInput, { target: { value: '200' } });
    fireEvent.change(minIntervalInput, { target: { value: '5m' } });

    // onChangeQueryOptions should not be called yet
    expect(onChangeQueryOptions).not.toHaveBeenCalled();

    // Close the toggletip
    fireEvent.click(closeButton);

    // Now onChangeQueryOptions should be called with the new values
    expect(onChangeQueryOptions).toHaveBeenCalledTimes(1);
    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 200, minInterval: '5m' }, 0);
  });

  it('should not call onChangeQueryOptions if values are not changed', () => {
    const { onChangeQueryOptions, closeButton } = setup();

    // Close the toggletip without changing anything
    fireEvent.click(closeButton);

    expect(onChangeQueryOptions).not.toHaveBeenCalled();
  });

  it('should handle Enter key to apply changes', () => {
    const { onChangeQueryOptions, maxDataPointsInput } = setup();

    fireEvent.change(maxDataPointsInput, { target: { value: '200' } });
    
    // Press enter on the input
    fireEvent.keyDown(maxDataPointsInput, { key: 'Enter', code: 'Enter' });

    expect(onChangeQueryOptions).toHaveBeenCalledTimes(1);
    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 200, minInterval: '1m' }, 0);
  });

  it('should ignore invalid interval values and fallback to previous valid value', () => {
    const { onChangeQueryOptions, minIntervalInput, closeButton } = setup();

    // Simulate user typing an invalid interval
    fireEvent.change(minIntervalInput, { target: { value: 'abc' } });
    
    fireEvent.click(closeButton);

    // onChangeQueryOptions should not be called with an invalid value because it falls back to '1m' which is unchanged
    expect(onChangeQueryOptions).not.toHaveBeenCalled();
  });

  it('should treat zero or invalid maxDataPoints as cleared (undefined) and reset input state', () => {
    const { onChangeQueryOptions, maxDataPointsInput, closeButton } = setup();

    // Simulate user typing 0 (invalid max data points)
    fireEvent.change(maxDataPointsInput, { target: { value: '0' } });
    
    fireEvent.click(closeButton);

    // onChangeQueryOptions should be called with maxDataPoints as undefined
    expect(onChangeQueryOptions).toHaveBeenCalledTimes(1);
    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: undefined, minInterval: '1m' }, 0);
  });

  it('should reset local state when external props change after a local edit', () => {
    const onChangeQueryOptions = jest.fn();
    const queryOptions = { maxDataPoints: 100, minInterval: '1m' };

    const { rerender } = render(
      <QueryOptions
        query={defaultQuery}
        queryOptions={queryOptions}
        onChangeQueryOptions={onChangeQueryOptions}
        index={0}
      />
    );

    // Open the toggletip
    const button = screen.getByRole('button', { name: /Options/i });
    fireEvent.click(button);

    const maxDataPointsInput = screen.getByRole('spinbutton', { name: /Max data points/i });

    // User types a local edit
    fireEvent.change(maxDataPointsInput, { target: { value: '999' } });
    expect(maxDataPointsInput).toHaveValue(999);

    // External prop change comes in (e.g. from another part of the UI)
    rerender(
      <QueryOptions
        query={defaultQuery}
        queryOptions={{ maxDataPoints: 500, minInterval: '10s' }}
        onChangeQueryOptions={onChangeQueryOptions}
        index={0}
      />
    );

    // Local state should be reset to the new external values
    expect(maxDataPointsInput).toHaveValue(500);
  });
});

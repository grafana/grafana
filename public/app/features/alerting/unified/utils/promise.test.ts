import { withTimeout } from './promise';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the work when it settles in time', async () => {
    const result = withTimeout(Promise.resolve('done'), 1_000, () => new Error('too slow'));

    await expect(result).resolves.toBe('done');
  });

  it('fails with the error from onTimeout when the work takes too long', async () => {
    const onTimeout = jest.fn(() => new Error('too slow'));
    const result = withTimeout(new Promise(() => {}), 1_000, onTimeout);

    jest.advanceTimersByTime(1_000);

    await expect(result).rejects.toThrow('too slow');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('does not call onTimeout once the work has settled', async () => {
    const onTimeout = jest.fn(() => new Error('too slow'));

    await withTimeout(Promise.resolve('done'), 1_000, onTimeout);
    jest.advanceTimersByTime(10_000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('passes the original rejection through untouched', async () => {
    const failure = new Error('the work itself failed');

    await expect(withTimeout(Promise.reject(failure), 1_000, () => new Error('too slow'))).rejects.toBe(failure);
  });
});

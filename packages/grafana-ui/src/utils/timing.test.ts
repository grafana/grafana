import { debounce, throttle } from './timing';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('debounce', () => {
  it('delays invocation until after wait ms', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the original function', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 50);

    debounced('a', 'b');
    jest.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledWith('a', 'b');
  });

  it('resets the timer on subsequent calls', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    jest.advanceTimersByTime(80);
    debounced();
    jest.advanceTimersByTime(80);

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses the last arguments when calls are batched', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('calls immediately with leading: true', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100, { leading: true });

    debounced('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('calls both leading and trailing by default when leading is true', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100, { leading: true });

    debounced('lead');
    debounced('trail');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('lead');

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('trail');
  });

  it('suppresses trailing call with trailing: false', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100, { leading: true, trailing: false });

    debounced('lead');
    debounced('ignored');

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('lead');
  });

  it('cancel prevents pending invocation', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();

    jest.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });

  it('can be called again after cancel', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('cancelled');
    debounced.cancel();
    debounced('new');

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('new');
  });
});

describe('throttle', () => {
  it('calls immediately on first invocation', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('suppresses calls within the wait period', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls with latest args as trailing after wait expires', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled('first');
    throttled('second');
    throttled('third');

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('third');
  });

  it('allows a new call after the wait period', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled('a');
    jest.advanceTimersByTime(100);

    throttled('b');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('cancel prevents the trailing invocation', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled('first');
    throttled('second');
    throttled.cancel();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');
  });

  it('can be called again after cancel', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled('old');
    throttled.cancel();

    throttled('new');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('new');
  });

  it('does not fire trailing if no intermediate calls', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled('only');
    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('only');
  });
});

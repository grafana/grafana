import { act, renderHook } from '@testing-library/react';

import useHomeGreeting from './useHomeGreeting';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

const setCurrentHour = (hour: number) => {
  jest.setSystemTime(new Date(2026, 0, 1, hour, 0, 0, 0));
};

describe('useHomeGreeting', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns morning greeting between 05:00 and 11:59', () => {
    setCurrentHour(5);

    const { result } = renderHook(() => useHomeGreeting());

    expect(result.current).toBe('Good morning.');
  });

  it('returns afternoon greeting between 12:00 and 17:59', () => {
    setCurrentHour(12);

    const { result } = renderHook(() => useHomeGreeting());

    expect(result.current).toBe('Good afternoon.');
  });

  it('returns evening greeting outside morning and afternoon ranges', () => {
    setCurrentHour(22);

    const { result } = renderHook(() => useHomeGreeting());

    expect(result.current).toBe('Good evening.');
  });

  it('updates the greeting when the hourly interval elapses', () => {
    setCurrentHour(11);

    const { result } = renderHook(() => useHomeGreeting());
    expect(result.current).toBe('Good morning.');

    act(() => {
      jest.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(result.current).toBe('Good afternoon.');
  });

  it('clears the interval when unmounted', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useHomeGreeting());
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});

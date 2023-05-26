import { renderHook, act } from '@testing-library/react';

import useLastError from './useLastError';

describe('AzureMonitor: useLastError', () => {
  it('returns the set error', () => {
    const { result } = renderHook(() => useLastError());

    act(() => {
      result.current[1]('component-a', new Error('an error'));
    });

    expect(result.current[0]).toBe('an error');
  });

  it('returns the most recent error', () => {
    const { result } = renderHook(() => useLastError());

    act(() => {
      result.current[1]('component-a', new Error('component a error'));
      result.current[1]('component-b', new Error('component b error'));
      result.current[1]('component-a', new Error('second component a error'));
    });

    expect(result.current[0]).toBe('second component a error');
  });
});

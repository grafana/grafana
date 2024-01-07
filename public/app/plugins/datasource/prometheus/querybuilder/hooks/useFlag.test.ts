import { act, renderHook } from '@testing-library/react';

import { promQueryEditorExplainKey, useFlag } from './useFlag';

describe('useFlag Hook', () => {
  beforeEach(() => {
    window.localStorage.removeItem(promQueryEditorExplainKey);
  });

  it('should return the default flag value as false', () => {
    const { result } = renderHook(() => useFlag(promQueryEditorExplainKey));
    expect(result.current.flag).toBe(false);
  });

  it('should update the flag value without error', () => {
    const { result } = renderHook(() => useFlag(promQueryEditorExplainKey, true));
    expect(result.current.flag).toBe(true);
    act(() => {
      result.current.setFlag(false);
    });
    expect(result.current.flag).toBe(false);
  });
});

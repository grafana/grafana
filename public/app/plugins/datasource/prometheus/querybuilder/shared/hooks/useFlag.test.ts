import { act, renderHook } from '@testing-library/react-hooks';

import { lokiQueryEditorExplainKey, promQueryEditorExplainKey, useFlag } from './useFlag';

describe('useFlag Hook', () => {
  beforeEach(() => {
    window.localStorage.removeItem(lokiQueryEditorExplainKey);
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

  it('should update different flags at once without conflict', () => {
    const { result } = renderHook(() => useFlag(promQueryEditorExplainKey, false));
    expect(result.current.flag).toBe(false);
    act(() => {
      result.current.setFlag(true);
    });
    expect(result.current.flag).toBe(true);

    const { result: result2 } = renderHook(() => useFlag(lokiQueryEditorExplainKey, false));
    expect(result.current.flag).toBe(true);
    expect(result2.current.flag).toBe(false);
  });
});

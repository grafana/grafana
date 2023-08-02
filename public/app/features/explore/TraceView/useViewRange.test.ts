import { renderHook, act } from '@testing-library/react';

import { useViewRange } from './useViewRange';

describe('useViewRange', () => {
  it('defaults to full range', async () => {
    const { result } = renderHook(() => useViewRange());
    expect(result.current.viewRange).toEqual({ time: { current: [0, 1] } });
  });

  describe('updateNextViewRangeTime', () => {
    it('updates time', async () => {
      const { result } = renderHook(() => useViewRange());
      act(() => result.current.updateNextViewRangeTime({ cursor: 0.5 }));
      expect(result.current.viewRange).toEqual({ time: { current: [0, 1], cursor: 0.5 } });
    });
  });

  describe('updateViewRangeTime', () => {
    it('updates time', async () => {
      const { result } = renderHook(() => useViewRange());
      act(() => result.current.updateViewRangeTime(0.1, 0.2));
      expect(result.current.viewRange).toEqual({ time: { current: [0.1, 0.2] } });
    });
  });
});

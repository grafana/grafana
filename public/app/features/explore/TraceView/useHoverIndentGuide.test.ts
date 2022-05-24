import { renderHook, act } from '@testing-library/react-hooks';

import { useHoverIndentGuide } from './useHoverIndentGuide';

describe('useHoverIndentGuide', () => {
  it('adds and removes indent guide ids', async () => {
    const { result } = renderHook(() => useHoverIndentGuide());
    expect(result.current.hoverIndentGuideIds.size).toBe(0);

    act(() => result.current.addHoverIndentGuideId('span1'));
    expect(result.current.hoverIndentGuideIds.size).toBe(1);
    expect(result.current.hoverIndentGuideIds.has('span1')).toBe(true);

    act(() => result.current.removeHoverIndentGuideId('span1'));
    expect(result.current.hoverIndentGuideIds.size).toBe(0);
  });
});

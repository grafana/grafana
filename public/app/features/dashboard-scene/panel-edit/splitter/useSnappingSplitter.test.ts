import { renderHook } from '@testing-library/react';

import { useSnappingSplitter } from './useSnappingSplitter';

// `useSplitter` is deliberately not mocked, so these assert the override against the real styles.
describe('useSnappingSplitter', () => {
  it('lets the primary pane shrink in pixel mode so the other pane can be dragged wider', () => {
    const { result } = renderHook(() =>
      useSnappingSplitter({ direction: 'row', usePixels: true, initialSize: 330, collapseBelowPixels: 150 })
    );

    expect(result.current.primaryProps.style.minWidth).toBe(0);
  });

  it('leaves the primary pane floored at its content width in flex mode', () => {
    const { result } = renderHook(() =>
      useSnappingSplitter({ direction: 'row', initialSize: 0.5, collapseBelowPixels: 150 })
    );

    expect(result.current.primaryProps.style.minWidth).toBe('min-content');
  });
});

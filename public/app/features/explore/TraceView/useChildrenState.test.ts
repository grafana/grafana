import { renderHook, act } from '@testing-library/react';

import { TraceSpan } from './components/types/trace';
import { useChildrenState } from './useChildrenState';

describe('useChildrenState', () => {
  describe('childrenToggle', () => {
    it('toggles children state', async () => {
      const { result } = renderHook(() => useChildrenState());
      expect(result.current.childrenHiddenIDs.size).toBe(0);
      act(() => result.current.childrenToggle('testId'));

      expect(result.current.childrenHiddenIDs.size).toBe(1);
      expect(result.current.childrenHiddenIDs.has('testId')).toBe(true);

      act(() => result.current.childrenToggle('testId'));

      expect(result.current.childrenHiddenIDs.size).toBe(0);
    });
  });

  describe('expandAll', () => {
    it('expands all', async () => {
      const { result } = renderHook(() => useChildrenState());
      act(() => result.current.childrenToggle('testId1'));
      act(() => result.current.childrenToggle('testId2'));

      expect(result.current.childrenHiddenIDs.size).toBe(2);

      act(() => result.current.expandAll());

      expect(result.current.childrenHiddenIDs.size).toBe(0);
    });
  });

  describe('collapseAll', () => {
    it('hides spans that have children', async () => {
      const { result } = renderHook(() => useChildrenState());
      act(() =>
        result.current.collapseAll([
          { spanID: 'span1', hasChildren: true } as TraceSpan,
          { spanID: 'span2', hasChildren: false } as TraceSpan,
        ])
      );

      expect(result.current.childrenHiddenIDs.size).toBe(1);
      expect(result.current.childrenHiddenIDs.has('span1')).toBe(true);
    });

    it('does nothing if already collapsed', async () => {
      const { result } = renderHook(() => useChildrenState());
      act(() => result.current.childrenToggle('span1'));
      act(() =>
        result.current.collapseAll([
          { spanID: 'span1', hasChildren: true } as TraceSpan,
          { spanID: 'span2', hasChildren: false } as TraceSpan,
        ])
      );

      expect(result.current.childrenHiddenIDs.size).toBe(1);
      expect(result.current.childrenHiddenIDs.has('span1')).toBe(true);
    });
  });

  // Other function are not yet used.
});

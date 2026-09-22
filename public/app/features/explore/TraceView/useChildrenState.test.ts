import { renderHook, act } from '@testing-library/react';

import { type TraceSpan } from './components/types/trace';
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

  describe('revealSpan', () => {
    const grandparent = { spanID: 'grandparent', references: [] } as unknown as TraceSpan;
    const parent = {
      spanID: 'parent',
      references: [{ refType: 'CHILD_OF', spanID: 'grandparent', span: grandparent }],
    } as TraceSpan;
    const child = {
      spanID: 'child',
      references: [{ refType: 'CHILD_OF', spanID: 'parent', span: parent }],
    } as TraceSpan;

    it('expands collapsed ancestors of the span and leaves other collapses alone', () => {
      const { result } = renderHook(() => useChildrenState());
      act(() => result.current.childrenToggle('grandparent'));
      act(() => result.current.childrenToggle('parent'));
      act(() => result.current.childrenToggle('unrelated'));

      act(() => result.current.revealSpan(child));

      expect(result.current.childrenHiddenIDs.has('grandparent')).toBe(false);
      expect(result.current.childrenHiddenIDs.has('parent')).toBe(false);
      expect(result.current.childrenHiddenIDs.has('unrelated')).toBe(true);
    });

    it('does nothing when ancestors are already expanded', () => {
      const { result } = renderHook(() => useChildrenState());
      act(() => result.current.childrenToggle('unrelated'));

      act(() => result.current.revealSpan(child));

      expect([...result.current.childrenHiddenIDs]).toEqual(['unrelated']);
    });
  });
});

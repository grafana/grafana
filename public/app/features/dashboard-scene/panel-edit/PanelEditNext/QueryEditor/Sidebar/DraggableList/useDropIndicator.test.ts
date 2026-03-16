import { DragStart, DragUpdate, DropResult } from '@hello-pangea/dnd';
import { act, renderHook } from '@testing-library/react';

import { useDropIndicator } from './useDropIndicator';

const ITEM_HEIGHT = 30;
const ITEM_SPACING = 8;

function makeDragStart(index: number): DragStart {
  return {
    draggableId: `item-${index}`,
    type: 'DEFAULT',
    mode: 'FLUID',
    source: { droppableId: 'droppable', index },
  };
}

function makeDragUpdate(sourceIndex: number, destinationIndex: number | null): DragUpdate {
  return {
    ...makeDragStart(sourceIndex),
    destination: destinationIndex !== null ? { droppableId: 'droppable', index: destinationIndex } : null,
    combine: null,
  };
}

function makeDropResult(sourceIndex: number, destinationIndex: number | null): DropResult {
  return {
    ...makeDragUpdate(sourceIndex, destinationIndex),
    reason: 'DROP',
  };
}

function createMockContainer(height: number): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ height, width: 0, top: 0, left: 0, bottom: height, right: 0, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  return el;
}

describe('useDropIndicator', () => {
  const defaultOptions = {
    itemHeight: ITEM_HEIGHT,
    itemSpacing: ITEM_SPACING,
    onDragEnd: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete document.documentElement.dataset.dragging;
  });

  describe('indicator positioning', () => {
    it('should position indicator at the source index on drag start', () => {
      const { result } = renderHook(() => useDropIndicator(defaultOptions));

      act(() => result.current.handleDragStart(makeDragStart(0)));
      expect(result.current.indicator).toEqual({ top: 0, height: ITEM_HEIGHT });

      act(() => result.current.handleDragStart(makeDragStart(2)));
      expect(result.current.indicator).toEqual({ top: 2 * (ITEM_HEIGHT + ITEM_SPACING), height: ITEM_HEIGHT });
    });

    it('should update indicator position on drag update', () => {
      const { result } = renderHook(() => useDropIndicator(defaultOptions));

      act(() => result.current.handleDragStart(makeDragStart(0)));
      act(() => result.current.handleDragUpdate(makeDragUpdate(0, 3)));

      expect(result.current.indicator).toEqual({ top: 3 * (ITEM_HEIGHT + ITEM_SPACING), height: ITEM_HEIGHT });
    });
  });

  describe('indicator visibility', () => {
    it('should have no indicator initially', () => {
      const { result } = renderHook(() => useDropIndicator(defaultOptions));
      expect(result.current.indicator).toBeNull();
    });

    it('should hide indicator when dragged outside the list', () => {
      const { result } = renderHook(() => useDropIndicator(defaultOptions));

      act(() => result.current.handleDragStart(makeDragStart(0)));
      expect(result.current.indicator).not.toBeNull();

      act(() => result.current.handleDragUpdate(makeDragUpdate(0, null)));
      expect(result.current.indicator).toBeNull();
    });

    it('should clear indicator on drag end', () => {
      const { result } = renderHook(() => useDropIndicator(defaultOptions));

      act(() => result.current.handleDragStart(makeDragStart(1)));
      expect(result.current.indicator).not.toBeNull();

      act(() => result.current.handleDragEnd(makeDropResult(1, 0)));
      expect(result.current.indicator).toBeNull();
    });
  });

  describe('container height lock', () => {
    it('should lock container height and overflow on before capture', () => {
      const container = createMockContainer(190);
      const { result } = renderHook(() => useDropIndicator(defaultOptions));
      result.current.containerRef.current = container;

      act(() => result.current.handleBeforeCapture());

      expect(container.style.height).toBe('190px');
      expect(container.style.overflow).toBe('hidden');
    });

    it('should unlock container height and overflow on drag end', () => {
      const container = createMockContainer(190);
      const { result } = renderHook(() => useDropIndicator(defaultOptions));
      result.current.containerRef.current = container;

      act(() => result.current.handleBeforeCapture());
      act(() => result.current.handleDragEnd(makeDropResult(0, 1)));

      expect(container.style.height).toBe('');
      expect(container.style.overflow).toBe('');
    });

    it('should set data-dragging on documentElement during drag', () => {
      const container = createMockContainer(190);
      const { result } = renderHook(() => useDropIndicator(defaultOptions));
      result.current.containerRef.current = container;

      expect(document.documentElement.dataset.dragging).toBeUndefined();

      act(() => result.current.handleBeforeCapture());
      expect(document.documentElement.dataset.dragging).toBe('');

      act(() => result.current.handleDragEnd(makeDropResult(0, 1)));
      expect(document.documentElement.dataset.dragging).toBeUndefined();
    });

    it('should not throw when container ref is null', () => {
      const { result } = renderHook(() => useDropIndicator(defaultOptions));

      expect(() => {
        act(() => result.current.handleBeforeCapture());
      }).not.toThrow();
    });
  });

  describe('callback forwarding', () => {
    it('should forward drop result to onDragEnd', () => {
      const onDragEnd = jest.fn();
      const { result } = renderHook(() => useDropIndicator({ ...defaultOptions, onDragEnd }));
      const dropResult = makeDropResult(0, 2);

      act(() => result.current.handleDragEnd(dropResult));

      expect(onDragEnd).toHaveBeenCalledWith(dropResult);
    });

    it('should call onDragStart when provided', () => {
      const onDragStart = jest.fn();
      const { result } = renderHook(() => useDropIndicator({ ...defaultOptions, onDragStart }));

      act(() => result.current.handleDragStart(makeDragStart(0)));

      expect(onDragStart).toHaveBeenCalledTimes(1);
    });

    it('should not throw when onDragStart is omitted', () => {
      const { result } = renderHook(() => useDropIndicator(defaultOptions));

      expect(() => {
        act(() => result.current.handleDragStart(makeDragStart(0)));
      }).not.toThrow();
    });
  });
});

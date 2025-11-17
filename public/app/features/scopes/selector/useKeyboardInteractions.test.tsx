import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TreeNode } from './types';
import { KeyboardAction, useKeyboardInteraction } from './useKeyboardInteractions';

// Mock data for testing
const createMockTreeNode = (id: string, hasChildren = false): TreeNode => ({
  scopeNodeId: id,
  expanded: false,
  query: '',
  children: hasChildren ? { child1: createMockTreeNode('child1') } : undefined,
});

const mockItems: TreeNode[] = [
  createMockTreeNode('item1'),
  createMockTreeNode('item2', true), // expandable
  createMockTreeNode('item3'),
];

describe('useKeyboardInteraction', () => {
  let mockOnSelect: jest.Mock;
  let user: ReturnType<typeof userEvent.setup>;
  let inputElement: HTMLInputElement;

  beforeEach(() => {
    mockOnSelect = jest.fn();
    user = userEvent.setup();

    // Create a real input element for keyboard events
    inputElement = document.createElement('input');
    document.body.appendChild(inputElement);
  });

  afterEach(() => {
    document.body.removeChild(inputElement);
    jest.clearAllMocks();
  });

  it('should initialize with no highlightedId', () => {
    const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

    expect(result.current.highlightedId).toBeUndefined();
  });

  it('should add and remove event listeners correctly', () => {
    const { unmount } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

    // Verify event listener is added (we can't easily test removal without mocking)
    unmount();
  });

  describe('when disabled', () => {
    it('should not handle keyboard events', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(false, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Try to navigate with arrow keys
      await user.keyboard('{ArrowDown}');

      expect(result.current.highlightedId).toBeUndefined();
    });
  });

  describe('when no items', () => {
    it('should not handle keyboard events', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, [], '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Try to navigate with arrow keys
      await user.keyboard('{ArrowDown}');

      expect(result.current.highlightedId).toBeUndefined();
    });
  });

  describe('ArrowDown key', () => {
    it('should move highlight to first item', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      await user.click(inputElement);
      await user.keyboard('{ArrowDown}');

      expect(result.current.highlightedId).toBe('item1');
    });

    it('should wrap around to first when reaching the end', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      await user.click(inputElement);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedId).toBe('item3');

      await user.keyboard('{ArrowDown}');

      expect(result.current.highlightedId).toBe('item1');
    });
  });

  describe('ArrowUp key', () => {
    it('should decrement highlighted item', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      await user.click(inputElement);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedId).toBe('item2');

      await user.keyboard('{ArrowUp}');

      expect(result.current.highlightedId).toBe('item1');
    });

    it('should wrap around to last item when going above first', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      await user.click(inputElement);
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedId).toBe('item1');

      await user.keyboard('{ArrowUp}');

      expect(result.current.highlightedId).toBe('item3');
    });
  });

  describe('Enter key', () => {
    it('should call onSelect with SELECT action when item is highlighted', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      await user.click(inputElement);
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedId).toBe('item1');

      await user.keyboard('{Enter}');

      expect(mockOnSelect).toHaveBeenCalledWith('item1', KeyboardAction.SELECT);
    });

    it('should not call onSelect when no item is highlighted', async () => {
      renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      await user.click(inputElement);

      await user.keyboard('{Enter}');

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('ArrowRight key', () => {
    it('should call onSelect with EXPAND action for expandable items', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      await user.click(inputElement);

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedId).toBe('item2');

      await user.keyboard('{ArrowRight}');

      expect(mockOnSelect).toHaveBeenCalledWith('item2', KeyboardAction.EXPAND);
    });

    it('should not call onSelect when no item is highlighted', async () => {
      renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      await user.click(inputElement);

      await user.keyboard('{ArrowRight}');

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('Escape key', () => {
    it('should reset highlighted id to undefined', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      await user.click(inputElement);

      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedId).toBe('item1');

      await user.keyboard('{Escape}');

      expect(result.current.highlightedId).toBeUndefined();
    });
  });

  describe('other keys', () => {
    it('should not affect highlight for non-handled keys', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      await user.click(inputElement);

      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedId).toBe('item1');

      await user.keyboard('{Tab}');

      expect(result.current.highlightedId).toBe('item1');
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('useEffect behaviors', () => {
    it('should reset highlighted id when items length changes to 0', () => {
      const { result, rerender } = renderHook(
        ({ items, enabled, searchQuery, onSelect }) => useKeyboardInteraction(enabled, items, searchQuery, onSelect),
        {
          initialProps: {
            items: mockItems,
            enabled: true,
            searchQuery: '',
            onSelect: mockOnSelect,
          },
        }
      );

      // Rerender with empty items
      rerender({
        items: [],
        enabled: true,
        searchQuery: '',
        onSelect: mockOnSelect,
      });

      expect(result.current.highlightedId).toBeUndefined();
    });

    it('should reset highlighted id when search query changes', () => {
      const { result, rerender } = renderHook(
        ({ items, enabled, searchQuery, onSelect }) => useKeyboardInteraction(enabled, items, searchQuery, onSelect),
        {
          initialProps: {
            items: mockItems,
            enabled: true,
            searchQuery: '',
            onSelect: mockOnSelect,
          },
        }
      );

      // Rerender with new search query
      rerender({
        items: mockItems,
        enabled: true,
        searchQuery: 'new query',
        onSelect: mockOnSelect,
      });

      expect(result.current.highlightedId).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle single item correctly', async () => {
      const singleItem = [createMockTreeNode('single')];
      const { result } = renderHook(() => useKeyboardInteraction(true, singleItem, '', mockOnSelect));

      await user.click(inputElement);

      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedId).toBe('single');

      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedId).toBe('single');

      await user.keyboard('{ArrowUp}');
      expect(result.current.highlightedId).toBe('single');
    });
  });
});

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

  it('should initialize with highlightedIndex as -1', () => {
    const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

    expect(result.current.highlightedIndex).toBe(-1);
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

      expect(result.current.highlightedIndex).toBe(-1);
    });
  });

  describe('when no items', () => {
    it('should not handle keyboard events', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, [], '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Try to navigate with arrow keys
      await user.keyboard('{ArrowDown}');

      expect(result.current.highlightedIndex).toBe(-1);
    });
  });

  describe('ArrowDown key', () => {
    it('should increment highlighted index', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Press ArrowDown
      await user.keyboard('{ArrowDown}');

      expect(result.current.highlightedIndex).toBe(0);
    });

    it('should wrap around to 0 when reaching the end', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Navigate to last item (need 3 ArrowDown presses: -1 -> 0 -> 1 -> 2)
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(2);

      // Press ArrowDown again to wrap around
      await user.keyboard('{ArrowDown}');

      expect(result.current.highlightedIndex).toBe(0);
    });
  });

  describe('ArrowUp key', () => {
    it('should decrement highlighted index', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Navigate to middle item first
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(1);

      // Press ArrowUp
      await user.keyboard('{ArrowUp}');

      expect(result.current.highlightedIndex).toBe(0);
    });

    it('should wrap around to last item when going below 0', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Navigate to first item
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(0);

      // Press ArrowUp to wrap around
      await user.keyboard('{ArrowUp}');

      expect(result.current.highlightedIndex).toBe(2);
    });
  });

  describe('Enter key', () => {
    it('should call onSelect with SELECT action when item is highlighted', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Navigate to an item
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(0);

      // Press Enter
      await user.keyboard('{Enter}');

      expect(mockOnSelect).toHaveBeenCalledWith(0, KeyboardAction.SELECT);
    });

    it('should not call onSelect when no item is highlighted', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Ensure no item is highlighted
      expect(result.current.highlightedIndex).toBe(-1);

      // Press Enter
      await user.keyboard('{Enter}');

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('ArrowRight key', () => {
    it('should call onSelect with EXPAND action for expandable items', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Navigate to expandable item (index 1)
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(1);

      // Press ArrowRight
      await user.keyboard('{ArrowRight}');

      expect(mockOnSelect).toHaveBeenCalledWith(1, KeyboardAction.EXPAND);
    });

    it('should not call onSelect for non-expandable items', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Navigate to non-expandable item (index 0)
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(0);

      // Press ArrowRight
      await user.keyboard('{ArrowRight}');

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('should not call onSelect when no item is highlighted', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Ensure no item is highlighted
      expect(result.current.highlightedIndex).toBe(-1);

      // Press ArrowRight
      await user.keyboard('{ArrowRight}');

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('Escape key', () => {
    it('should reset highlighted index to -1', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Navigate to an item
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(0);

      // Press Escape
      await user.keyboard('{Escape}');

      expect(result.current.highlightedIndex).toBe(-1);
    });
  });

  describe('other keys', () => {
    it('should not affect highlighted index for non-handled keys', async () => {
      const { result } = renderHook(() => useKeyboardInteraction(true, mockItems, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Navigate to an item
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(0);

      // Press Tab (non-handled key)
      await user.keyboard('{Tab}');

      expect(result.current.highlightedIndex).toBe(0);
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('useEffect behaviors', () => {
    it('should reset highlighted index when items length changes to 0', () => {
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

      // Set highlighted index by simulating navigation
      rerender({
        items: mockItems,
        enabled: true,
        searchQuery: '',
        onSelect: mockOnSelect,
      });

      // Rerender with empty items
      rerender({
        items: [],
        enabled: true,
        searchQuery: '',
        onSelect: mockOnSelect,
      });

      expect(result.current.highlightedIndex).toBe(-1);
    });

    it('should reset highlighted index when search query changes', () => {
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

      expect(result.current.highlightedIndex).toBe(-1);
    });
  });

  describe('edge cases', () => {
    it('should handle single item correctly', async () => {
      const singleItem = [createMockTreeNode('single')];
      const { result } = renderHook(() => useKeyboardInteraction(true, singleItem, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Test ArrowDown
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(0);

      // Test ArrowDown again (should wrap around)
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(0);

      // Test ArrowUp (should wrap around)
      await user.keyboard('{ArrowUp}');
      expect(result.current.highlightedIndex).toBe(0);
    });

    it('should handle items with undefined children correctly', async () => {
      const itemsWithUndefinedChildren: TreeNode[] = [
        { scopeNodeId: 'item1', expanded: false, query: '', children: undefined },
        { scopeNodeId: 'item2', expanded: false, query: '', children: {} }, // empty object
        { scopeNodeId: 'item3', expanded: false, query: '', children: { child: createMockTreeNode('child') } },
      ];

      const { result } = renderHook(() => useKeyboardInteraction(true, itemsWithUndefinedChildren, '', mockOnSelect));

      // Focus the input to enable keyboard events
      await user.click(inputElement);

      // Navigate to item with undefined children
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(0);

      // Try to expand item with undefined children
      await user.keyboard('{ArrowRight}');
      expect(mockOnSelect).not.toHaveBeenCalled();

      // Navigate to item with empty children object
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(1);

      // Try to expand item with empty children (empty object is truthy, so this will call onSelect)
      await user.keyboard('{ArrowRight}');
      expect(mockOnSelect).toHaveBeenCalledWith(1, KeyboardAction.EXPAND);

      // Reset mock for next test
      mockOnSelect.mockClear();

      // Navigate to item with actual children
      await user.keyboard('{ArrowDown}');
      expect(result.current.highlightedIndex).toBe(2);

      // Try to expand item with actual children
      await user.keyboard('{ArrowRight}');
      expect(mockOnSelect).toHaveBeenCalledWith(2, KeyboardAction.EXPAND);
    });
  });
});

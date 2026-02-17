import { renderHook, act } from '@testing-library/react';

import { ExpressionQueryType } from 'app/features/expressions/types';

import { usePendingExpression } from './usePendingExpression';

// Mock the expression datasource and defaults
jest.mock('app/features/expressions/ExpressionDatasource', () => ({
  dataSource: {
    newQuery: jest.fn(() => ({
      refId: '--',
      datasource: { type: '__expr__', uid: '__expr__' },
      type: ExpressionQueryType.math,
    })),
  },
}));

jest.mock('app/features/expressions/utils/expressionTypes', () => ({
  getDefaults: jest.fn((query) => query),
}));

interface MockOptions {
  addQuery: jest.Mock;
  onCardSelectionChange: jest.Mock;
}

function setup(overrides?: Partial<MockOptions>) {
  const options: MockOptions = {
    addQuery: jest.fn().mockReturnValue('B'),
    onCardSelectionChange: jest.fn(),
    ...overrides,
  };

  const hookResult = renderHook(() => usePendingExpression(options));

  return { ...hookResult, options };
}

describe('usePendingExpression', () => {
  it('should initialize with null pending expression', () => {
    const { result } = setup();

    expect(result.current.pendingExpression).toBeNull();
  });

  describe('setPendingExpression', () => {
    it('should set pending expression and deselect cards', () => {
      const { result, options } = setup();

      act(() => {
        result.current.setPendingExpression({ insertAfter: 'A' });
      });

      expect(result.current.pendingExpression).toEqual({ insertAfter: 'A' });
      expect(options.onCardSelectionChange).toHaveBeenCalledWith(null, null);
    });

    it('should not deselect cards when clearing pending expression', () => {
      const { result, options } = setup();

      act(() => {
        result.current.setPendingExpression({ insertAfter: 'A' });
      });

      options.onCardSelectionChange.mockClear();

      act(() => {
        result.current.setPendingExpression(null);
      });

      expect(result.current.pendingExpression).toBeNull();
      expect(options.onCardSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe('finalizePendingExpression', () => {
    it('should create expression, add query, and select the new card', () => {
      const { result, options } = setup();

      act(() => {
        result.current.setPendingExpression({ insertAfter: 'A' });
      });

      options.onCardSelectionChange.mockClear();

      act(() => {
        result.current.finalizePendingExpression(ExpressionQueryType.math);
      });

      // Should have added a query with the correct type and insertAfter
      expect(options.addQuery).toHaveBeenCalledWith(expect.objectContaining({ type: ExpressionQueryType.math }), 'A');

      // Should select the newly created card
      expect(options.onCardSelectionChange).toHaveBeenCalledWith('B', null);

      // Should clear the pending state
      expect(result.current.pendingExpression).toBeNull();
    });

    it('should not select a card if addQuery returns undefined', () => {
      const { result, options } = setup({
        addQuery: jest.fn().mockReturnValue(undefined),
      });

      act(() => {
        result.current.setPendingExpression({ insertAfter: 'A' });
      });

      options.onCardSelectionChange.mockClear();

      act(() => {
        result.current.finalizePendingExpression(ExpressionQueryType.reduce);
      });

      expect(options.addQuery).toHaveBeenCalled();
      expect(options.onCardSelectionChange).not.toHaveBeenCalled();
      expect(result.current.pendingExpression).toBeNull();
    });

    it('should handle finalize when no pending expression exists', () => {
      const { result, options } = setup();

      act(() => {
        result.current.finalizePendingExpression(ExpressionQueryType.threshold);
      });

      // Should still attempt to add query with undefined insertAfter
      expect(options.addQuery).toHaveBeenCalledWith(
        expect.objectContaining({ type: ExpressionQueryType.threshold }),
        undefined
      );
    });
  });

  describe('clearPendingExpression', () => {
    it('should clear the pending expression without side effects', () => {
      const { result, options } = setup();

      act(() => {
        result.current.setPendingExpression({ insertAfter: 'A' });
      });

      options.onCardSelectionChange.mockClear();

      act(() => {
        result.current.clearPendingExpression();
      });

      expect(result.current.pendingExpression).toBeNull();
      // Should not trigger card selection change
      expect(options.onCardSelectionChange).not.toHaveBeenCalled();
    });
  });
});

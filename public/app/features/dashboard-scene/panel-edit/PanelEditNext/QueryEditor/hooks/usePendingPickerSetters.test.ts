import { renderHook, act } from '@testing-library/react';

import { usePendingPickerSetters } from './usePendingPickerSetters';

interface MockArgs {
  exitStackedMode: jest.Mock;
  setPendingExpression: jest.Mock;
  setPendingTransformation: jest.Mock;
  setPendingSavedQuery: jest.Mock;
}

function setup() {
  const args: MockArgs = {
    exitStackedMode: jest.fn(),
    setPendingExpression: jest.fn(),
    setPendingTransformation: jest.fn(),
    setPendingSavedQuery: jest.fn(),
  };

  const hookResult = renderHook(() => usePendingPickerSetters(args));

  return { ...hookResult, args };
}

describe('usePendingPickerSetters', () => {
  describe('opening a picker', () => {
    it('exits stacked mode, clears the other two pickers, and writes the expression', () => {
      const { result, args } = setup();
      const pending = { insertAfter: 'A' };

      act(() => {
        result.current.setPendingExpression(pending);
      });

      expect(args.exitStackedMode).toHaveBeenCalledTimes(1);
      expect(args.setPendingTransformation).toHaveBeenCalledWith(null);
      expect(args.setPendingSavedQuery).toHaveBeenCalledWith(null);
      // The bare expression setter is invoked exactly once — with the pending value, not null.
      expect(args.setPendingExpression).toHaveBeenCalledTimes(1);
      expect(args.setPendingExpression).toHaveBeenCalledWith(pending);
    });

    it('exits stacked mode, clears the other two pickers, and writes the transformation', () => {
      const { result, args } = setup();
      const pending = { insertAfter: 'reduce-0' };

      act(() => {
        result.current.setPendingTransformation(pending);
      });

      expect(args.exitStackedMode).toHaveBeenCalledTimes(1);
      expect(args.setPendingExpression).toHaveBeenCalledWith(null);
      expect(args.setPendingSavedQuery).toHaveBeenCalledWith(null);
      expect(args.setPendingTransformation).toHaveBeenCalledTimes(1);
      expect(args.setPendingTransformation).toHaveBeenCalledWith(pending);
    });

    it('exits stacked mode, clears the other two pickers, and writes the saved query', () => {
      const { result, args } = setup();
      const pending = { insertAfter: 'B' };

      act(() => {
        result.current.setPendingSavedQuery(pending);
      });

      expect(args.exitStackedMode).toHaveBeenCalledTimes(1);
      expect(args.setPendingExpression).toHaveBeenCalledWith(null);
      expect(args.setPendingTransformation).toHaveBeenCalledWith(null);
      expect(args.setPendingSavedQuery).toHaveBeenCalledTimes(1);
      expect(args.setPendingSavedQuery).toHaveBeenCalledWith(pending);
    });
  });

  describe('closing a picker (writing null)', () => {
    it('does not exit stacked mode or touch the other pickers', () => {
      const { result, args } = setup();

      act(() => {
        result.current.setPendingExpression(null);
      });

      expect(args.exitStackedMode).not.toHaveBeenCalled();
      expect(args.setPendingTransformation).not.toHaveBeenCalled();
      expect(args.setPendingSavedQuery).not.toHaveBeenCalled();
      expect(args.setPendingExpression).toHaveBeenCalledWith(null);
    });

    it('writes null through for the transformation setter without side effects', () => {
      const { result, args } = setup();

      act(() => {
        result.current.setPendingTransformation(null);
      });

      expect(args.exitStackedMode).not.toHaveBeenCalled();
      expect(args.setPendingExpression).not.toHaveBeenCalled();
      expect(args.setPendingSavedQuery).not.toHaveBeenCalled();
      expect(args.setPendingTransformation).toHaveBeenCalledWith(null);
    });

    it('writes null through for the saved-query setter without side effects', () => {
      const { result, args } = setup();

      act(() => {
        result.current.setPendingSavedQuery(null);
      });

      expect(args.exitStackedMode).not.toHaveBeenCalled();
      expect(args.setPendingExpression).not.toHaveBeenCalled();
      expect(args.setPendingTransformation).not.toHaveBeenCalled();
      expect(args.setPendingSavedQuery).toHaveBeenCalledWith(null);
    });
  });

  describe('cross-exclusion sequencing', () => {
    it('opening a second picker after a first closes the first via its raw setter', () => {
      const { result, args } = setup();
      const expression = { insertAfter: 'A' };
      const transformation = { insertAfter: 'reduce-0' };

      act(() => {
        result.current.setPendingExpression(expression);
      });
      args.setPendingExpression.mockClear();

      // Opening transformation must clear expression (via its bare setter) and saved query,
      // then write transformation — same observable contract regardless of prior state.
      act(() => {
        result.current.setPendingTransformation(transformation);
      });

      expect(args.setPendingExpression).toHaveBeenCalledWith(null);
      expect(args.setPendingSavedQuery).toHaveBeenCalledWith(null);
      expect(args.setPendingTransformation).toHaveBeenLastCalledWith(transformation);
    });
  });

  describe('referential stability', () => {
    it('returned setters keep stable identities across re-renders when inputs are stable', () => {
      const { result, rerender } = setup();
      const first = { ...result.current };

      rerender();

      expect(result.current.setPendingExpression).toBe(first.setPendingExpression);
      expect(result.current.setPendingTransformation).toBe(first.setPendingTransformation);
      expect(result.current.setPendingSavedQuery).toBe(first.setPendingSavedQuery);
    });
  });
});

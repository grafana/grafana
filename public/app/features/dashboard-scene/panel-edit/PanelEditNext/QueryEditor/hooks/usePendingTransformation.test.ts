import { renderHook, act } from '@testing-library/react';

import { usePendingTransformation } from './usePendingTransformation';

interface MockOptions {
  addTransformation: jest.Mock;
  onCardSelectionChange: jest.Mock;
}

function setup(overrides?: Partial<MockOptions>) {
  const options: MockOptions = {
    addTransformation: jest.fn().mockReturnValue('seriesToColumns-0'),
    onCardSelectionChange: jest.fn(),
    ...overrides,
  };

  const hookResult = renderHook(() => usePendingTransformation(options));

  return { ...hookResult, options };
}

describe('usePendingTransformation', () => {
  it('should initialize with null pending transformation', () => {
    const { result } = setup();

    expect(result.current.pendingTransformation).toBeNull();
  });

  describe('setPendingTransformation', () => {
    it('should set pending transformation and deselect cards', () => {
      const { result, options } = setup();

      act(() => {
        result.current.setPendingTransformation({ insertAfter: 'reduce-0' });
      });

      expect(result.current.pendingTransformation).toEqual({ insertAfter: 'reduce-0' });
      expect(options.onCardSelectionChange).toHaveBeenCalledWith(null, null);
    });

    it('should not deselect cards when clearing pending transformation', () => {
      const { result, options } = setup();

      act(() => {
        result.current.setPendingTransformation({ insertAfter: 'reduce-0' });
      });

      options.onCardSelectionChange.mockClear();

      act(() => {
        result.current.setPendingTransformation(null);
      });

      expect(result.current.pendingTransformation).toBeNull();
      expect(options.onCardSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe('finalizePendingTransformation', () => {
    it('should add transformation and select the new card', () => {
      const { result, options } = setup();

      act(() => {
        result.current.setPendingTransformation({ insertAfter: 'reduce-0' });
      });

      options.onCardSelectionChange.mockClear();

      act(() => {
        result.current.finalizePendingTransformation('seriesToColumns');
      });

      expect(options.addTransformation).toHaveBeenCalledWith('seriesToColumns', 'reduce-0');
      expect(options.onCardSelectionChange).toHaveBeenCalledWith(null, 'seriesToColumns-0');
      expect(result.current.pendingTransformation).toBeNull();
    });

    it('should not select a card if addTransformation returns undefined', () => {
      const { result, options } = setup({
        addTransformation: jest.fn().mockReturnValue(undefined),
      });

      act(() => {
        result.current.setPendingTransformation({ insertAfter: 'reduce-0' });
      });

      options.onCardSelectionChange.mockClear();

      act(() => {
        result.current.finalizePendingTransformation('seriesToColumns');
      });

      expect(options.addTransformation).toHaveBeenCalled();
      expect(options.onCardSelectionChange).not.toHaveBeenCalled();
      expect(result.current.pendingTransformation).toBeNull();
    });

    it('should handle finalize when no pending transformation exists', () => {
      const { result, options } = setup();

      act(() => {
        result.current.finalizePendingTransformation('seriesToColumns');
      });

      // Should still attempt to add transformation with undefined insertAfter
      expect(options.addTransformation).toHaveBeenCalledWith('seriesToColumns', undefined);
    });

    it('should append to end when insertAfter is undefined', () => {
      const { result, options } = setup();

      act(() => {
        result.current.setPendingTransformation({});
      });

      options.onCardSelectionChange.mockClear();

      act(() => {
        result.current.finalizePendingTransformation('reduce');
      });

      expect(options.addTransformation).toHaveBeenCalledWith('reduce', undefined);
    });
  });

  describe('clearPendingTransformation', () => {
    it('should clear the pending transformation without side effects', () => {
      const { result, options } = setup();

      act(() => {
        result.current.setPendingTransformation({ insertAfter: 'reduce-0' });
      });

      options.onCardSelectionChange.mockClear();

      act(() => {
        result.current.clearPendingTransformation();
      });

      expect(result.current.pendingTransformation).toBeNull();
      expect(options.onCardSelectionChange).not.toHaveBeenCalled();
    });
  });
});

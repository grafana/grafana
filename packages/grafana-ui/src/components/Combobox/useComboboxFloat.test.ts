import { act, renderHook } from '@testing-library/react';

import { useComboboxFloat } from './useComboboxFloat';

let mockSizeApply: ((args: { availableWidth: number; availableHeight: number }) => void) | undefined;

jest.mock('@floating-ui/react', () => ({
  autoPlacement: jest.fn(),
  autoUpdate: jest.fn(),
  size: jest.fn(({ apply }) => {
    mockSizeApply = apply;
  }),
  useFloating: jest.fn(() => ({ floatingStyles: {} })),
}));

describe('useComboboxFloat', () => {
  it('does not rerender for an unchanged floating size measurement', () => {
    let renderCount = 0;

    renderHook(() => {
      renderCount++;
      return useComboboxFloat([], false);
    });

    act(() => {
      mockSizeApply?.({ availableWidth: 500, availableHeight: 400 });
    });
    expect(renderCount).toBe(2);

    act(() => {
      mockSizeApply?.({ availableWidth: 500, availableHeight: 400 });
    });
    expect(renderCount).toBe(2);
  });
});

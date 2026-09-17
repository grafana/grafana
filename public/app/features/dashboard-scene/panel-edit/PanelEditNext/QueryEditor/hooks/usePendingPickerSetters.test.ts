import { renderHook, act } from '@testing-library/react';

import { usePendingPickerSetters } from './usePendingPickerSetters';

function setup() {
  const args = {
    setPendingExpression: jest.fn(),
    setPendingTransformation: jest.fn(),
    setPendingSavedQuery: jest.fn(),
  };

  const { result, rerender } = renderHook(() => usePendingPickerSetters(args));

  return { result, rerender, args };
}

const PENDING = { insertAfter: 'A' };

type RawSetter = 'setPendingExpression' | 'setPendingTransformation' | 'setPendingSavedQuery';
type Wrapped = ReturnType<typeof setup>['result']['current'];

// Each row exercises one picker; the symmetric invariant (clear the other two) is expressed
// once in the test bodies below.
const PICKERS: Array<{
  kind: string;
  target: RawSetter;
  others: RawSetter[];
  open: (s: Wrapped) => void;
  close: (s: Wrapped) => void;
}> = [
  {
    kind: 'expression',
    target: 'setPendingExpression',
    others: ['setPendingTransformation', 'setPendingSavedQuery'],
    open: (s) => s.setPendingExpression(PENDING),
    close: (s) => s.setPendingExpression(null),
  },
  {
    kind: 'transformation',
    target: 'setPendingTransformation',
    others: ['setPendingExpression', 'setPendingSavedQuery'],
    open: (s) => s.setPendingTransformation(PENDING),
    close: (s) => s.setPendingTransformation(null),
  },
  {
    kind: 'saved query',
    target: 'setPendingSavedQuery',
    others: ['setPendingExpression', 'setPendingTransformation'],
    open: (s) => s.setPendingSavedQuery(PENDING),
    close: (s) => s.setPendingSavedQuery(null),
  },
];

describe('usePendingPickerSetters', () => {
  it.each(PICKERS)('opening the $kind picker clears the other two', ({ open, target, others }) => {
    const { result, args } = setup();

    act(() => open(result.current));

    expect(args[target]).toHaveBeenCalledWith(PENDING);
    for (const other of others) {
      expect(args[other]).toHaveBeenCalledWith(null);
    }
  });

  it.each(PICKERS)('closing the $kind picker does not touch other pickers', ({ close, target, others }) => {
    const { result, args } = setup();

    act(() => close(result.current));

    expect(args[target]).toHaveBeenCalledWith(null);
    for (const other of others) {
      expect(args[other]).not.toHaveBeenCalled();
    }
  });

  it('returned setters keep stable identities across re-renders', () => {
    const { result, rerender } = setup();
    const first = { ...result.current };

    rerender();

    expect(result.current.setPendingExpression).toBe(first.setPendingExpression);
    expect(result.current.setPendingTransformation).toBe(first.setPendingTransformation);
    expect(result.current.setPendingSavedQuery).toBe(first.setPendingSavedQuery);
  });
});

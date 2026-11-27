import { act, renderHook } from '@testing-library/react';

import { type ComboboxOption } from './types';
import { useMeasureMulti } from './useMeasureMulti';

// Canvas text metrics aren't real in jsdom. With 50px of text, each pill is estimated at 100px.
jest.mock('../../utils/measureText', () => ({
  measureText: jest.fn(() => ({ width: 50 })),
}));

// Reports a fixed width per observed element, so the hook sees the layout a browser would give it
const elementWidths = new Map<Element, number>();
class SizedResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(element: Element) {
    const entry = { contentRect: { width: elementWidths.get(element) ?? 0 } } as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

const selectedItems: Array<ComboboxOption<string>> = ['Austria', 'Iceland', 'Fiji', 'Ireland', 'Finland'].map(
  (label) => ({ label, value: label })
);

function sizedElement(width: number) {
  const element = document.createElement('div');
  elementWidths.set(element, width);
  return element;
}

describe('useMeasureMulti', () => {
  const originalResizeObserver = window.ResizeObserver;

  beforeEach(() => {
    window.ResizeObserver = SizedResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
    elementWidths.clear();
  });

  // The wrapper is 34px narrower than the container (padding, border and suffix space), and the suffix is 16px wide
  it.each([
    {
      desc: 'fits pills into the measured pixel width of a fixed width container',
      width: 60,
      maxWidth: undefined,
      parentWidth: 1000,
      expected: 4, // 446px wrapper - 16px suffix = 430px
    },
    {
      desc: 'lets an auto width container without maxWidth grow to fit every pill within its parent',
      width: 'auto' as const,
      maxWidth: undefined,
      parentWidth: 1000,
      expected: 5,
    },
    {
      desc: 'hides pills that would make an auto width container without maxWidth wider than its parent',
      width: 'auto' as const,
      maxWidth: undefined,
      parentWidth: 300,
      expected: 2, // 300px parent - 34px - 16px suffix = 250px
    },
    {
      desc: 'lets an auto width container grow up to maxWidth before hiding pills',
      width: 'auto' as const,
      maxWidth: 40,
      parentWidth: 1000,
      expected: 2, // 320px maxWidth - 34px - 16px suffix = 270px
    },
    {
      desc: 'limits an auto width container to its parent when that is narrower than maxWidth',
      width: 'auto' as const,
      maxWidth: 40,
      parentWidth: 200,
      expected: 1, // 200px parent - 34px - 16px suffix = 150px
    },
  ])('$desc', ({ width, maxWidth, parentWidth, expected }) => {
    const containerWidth = width === 'auto' ? 180 : 480;
    const parent = sizedElement(parentWidth);
    const container = parent.appendChild(sizedElement(containerWidth));
    const { result } = renderHook(() => useMeasureMulti(selectedItems, width, false, maxWidth));

    act(() => {
      result.current.containerMeasureRef(container);
      result.current.measureRef(sizedElement(containerWidth - 34));
      result.current.suffixMeasureRef(sizedElement(16));
    });

    expect(result.current.shownItems).toBe(expected);
  });

  it('shows every pill again once removing one leaves room for all of them without the counter', () => {
    const { result, rerender } = renderHook((items) => useMeasureMulti(items, 30, false), {
      initialProps: selectedItems.slice(0, 3),
    });

    // 214px for pills: three 100px pills don't fit, two do, but not next to the 45px counter
    act(() => {
      result.current.containerMeasureRef(sizedElement(264));
      result.current.measureRef(sizedElement(230));
      result.current.suffixMeasureRef(sizedElement(16));
      result.current.counterMeasureRef(sizedElement(45));
    });
    expect(result.current.shownItems).toBe(1);

    rerender(selectedItems.slice(1, 3));

    expect(result.current.shownItems).toBe(2);
  });
});

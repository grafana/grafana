import { act, renderHook } from '@testing-library/react';

import { useBreadcrumbTruncation } from './useBreadcrumbTruncation';

describe('useBreadcrumbTruncation', () => {
  let element: HTMLElement;
  let observer: ResizeObserver;
  let resize: () => void;
  const measurements = { clientWidth: 100, scrollWidth: 100, elementWidth: 100, textWidth: 100 };

  beforeEach(() => {
    Object.assign(measurements, { clientWidth: 100, scrollWidth: 100, elementWidth: 100, textWidth: 100 });
    element = createMeasuredElement();
    const rect = element.getBoundingClientRect();
    const range = document.createRange();
    range.getBoundingClientRect = () => ({ ...rect, width: measurements.textWidth });
    jest.spyOn(document, 'createRange').mockReturnValue(range);
    observer = { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
    jest.spyOn(window, 'ResizeObserver').mockImplementation((callback) => {
      resize = () => callback([], observer);
      return observer;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createMeasuredElement() {
    const element = document.createElement('span');
    Object.defineProperties(element, {
      clientWidth: { get: () => measurements.clientWidth },
      scrollWidth: { get: () => measurements.scrollWidth },
    });
    const rect = element.getBoundingClientRect();
    jest.spyOn(element, 'getBoundingClientRect').mockImplementation(() => ({
      ...rect,
      width: measurements.elementWidth,
    }));
    return element;
  }

  function renderTruncationHook(initialProps = { text: 'Dashboard', isCurrent: true }) {
    return renderHook(
      ({ text, isCurrent }) => {
        const state = useBreadcrumbTruncation(text, isCurrent);
        state.breadcrumbRef.current = element;
        return state;
      },
      { initialProps }
    );
  }

  it.each([
    {
      description: 'text wider than its element',
      clientWidth: 100,
      scrollWidth: 200,
      elementWidth: 100,
      textWidth: 200,
      isTruncated: true,
    },
    {
      description: 'text fitting exactly',
      clientWidth: 100,
      scrollWidth: 100,
      elementWidth: 100,
      textWidth: 100,
      isTruncated: false,
    },
    {
      description: 'text shorter than its element',
      clientWidth: 100,
      scrollWidth: 100,
      elementWidth: 100,
      textWidth: 80,
      isTruncated: false,
    },
    {
      description: 'fractional overflow rounded to equal integer widths',
      clientWidth: 81,
      scrollWidth: 81,
      elementWidth: 80.8671875,
      textWidth: 81.1015625,
      isTruncated: true,
    },
    {
      description: 'fractional widths fitting exactly',
      clientWidth: 82,
      scrollWidth: 82,
      elementWidth: 81.8671875,
      textWidth: 81.8671875,
      isTruncated: false,
    },
  ])('detects truncation for $description', ({ isTruncated, ...sizes }) => {
    Object.assign(measurements, sizes);
    const { result } = renderTruncationHook();

    expect(result.current.isTruncated).toBe(isTruncated);
  });

  it('updates truncation when the element resizes', () => {
    Object.assign(measurements, { scrollWidth: 200, textWidth: 200 });
    const { result } = renderTruncationHook();
    expect(result.current.isTruncated).toBe(true);

    Object.assign(measurements, { clientWidth: 200, elementWidth: 200 });
    act(() => resize());
    expect(result.current.isTruncated).toBe(false);

    Object.assign(measurements, { clientWidth: 100, elementWidth: 100 });
    act(() => resize());
    expect(result.current.isTruncated).toBe(true);
  });

  it('checks truncation again when the label changes', () => {
    const { result, rerender } = renderTruncationHook({ text: 'Short', isCurrent: true });
    expect(result.current.isTruncated).toBe(false);

    Object.assign(measurements, { scrollWidth: 200, textWidth: 200 });
    rerender({ text: 'A longer dashboard title', isCurrent: true });
    expect(result.current.isTruncated).toBe(true);
  });

  it('observes the replacement element when truncation changes the tooltip wrapper', () => {
    const { result } = renderTruncationHook();
    expect(observer.observe).toHaveBeenCalledWith(element);

    element = createMeasuredElement();
    Object.assign(measurements, { scrollWidth: 200, textWidth: 200 });
    act(() => resize());

    expect(result.current.isTruncated).toBe(true);
    expect(jest.mocked(observer.observe).mock.calls.at(-1)?.[0]).toBe(element);

    Object.assign(measurements, { clientWidth: 200, elementWidth: 200 });
    act(() => resize());
    expect(result.current.isTruncated).toBe(false);
  });

  it('checks truncation again when the current breadcrumb becomes a link', () => {
    const { result, rerender } = renderTruncationHook();
    expect(result.current.isTruncated).toBe(false);

    Object.assign(measurements, { scrollWidth: 200, textWidth: 200 });
    rerender({ text: 'Dashboard', isCurrent: false });
    expect(result.current.isTruncated).toBe(true);
  });

  it('disconnects the resize observer on unmount', () => {
    const { unmount } = renderTruncationHook();
    expect(observer.observe).toHaveBeenCalledWith(element);

    unmount();

    expect(observer.disconnect).toHaveBeenCalled();
  });
});

import { act, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';

import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { type StackedEditorItem } from '../QueryEditorContext';

import { useStackedItemScroll } from './useStackedItemScroll';
import { type StackedItem } from './utils';

interface StackProps {
  items: readonly StackedItem[];
  selectedItem: StackedEditorItem | null;
  onActiveItemChange: (item: StackedEditorItem) => void;
}

function Stack({ items, selectedItem, onActiveItemChange }: StackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useStackedItemScroll({ containerRef, contentRef, items, selectedItem, onActiveItemChange });
  return (
    <div ref={containerRef} data-testid="scroll-container">
      <div ref={contentRef}>
        {items.map((item) => (
          <div
            key={`${item.type}:${item.id}`}
            data-testid={`section-${item.type}-${item.id}`}
            data-stacked-editor-item-id={item.id}
            data-stacked-editor-item-type={item.type}
          />
        ))}
      </div>
    </div>
  );
}

function makeQueryItem(refId: string): StackedItem {
  const query: DataQuery = { refId };
  return { type: QueryEditorType.Query, id: refId, query };
}

function queryRef(id: string): StackedEditorItem {
  return { type: QueryEditorType.Query, id };
}

// Minimal IntersectionObserver fake — lets a test drive which section is "dominant" so we can
// exercise the scroll → selection direction. Mirrors useActiveStackedItemObserver's own test.
function mockIntersectionObserver() {
  let callback: IntersectionObserverCallback | undefined;
  const original = global.IntersectionObserver;

  class FakeIntersectionObserver {
    constructor(cb: IntersectionObserverCallback) {
      callback = cb;
    }
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
    takeRecords = jest.fn(() => []);
  }
  global.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;

  return {
    // Report `id` as the sole dominant section; every other section is reported as out of view.
    fireDominant: (id: string) => {
      const entries = Array.from(document.querySelectorAll('[data-stacked-editor-item-id]')).map((target) => {
        const isTarget = target.getAttribute('data-stacked-editor-item-id') === id;
        return {
          target,
          isIntersecting: isTarget,
          intersectionRatio: isTarget ? 1 : 0,
          boundingClientRect: { top: 0 },
        };
      });
      act(() => {
        callback?.(entries as unknown as IntersectionObserverEntry[], {} as IntersectionObserver);
      });
    },
    restore: () => {
      global.IntersectionObserver = original;
    },
  };
}

describe('useStackedItemScroll', () => {
  let scrollIntoViewSpy: jest.Mock;
  let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
  let io: ReturnType<typeof mockIntersectionObserver>;

  beforeEach(() => {
    jest.useFakeTimers();
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    scrollIntoViewSpy = jest.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
    io = mockIntersectionObserver();
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    io.restore();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('smoothly scrolls the selected card to the top on mount, animating the deliberate navigation', () => {
    const items = [makeQueryItem('A'), makeQueryItem('B'), makeQueryItem('C')];
    const { getByTestId } = render(<Stack items={items} selectedItem={queryRef('C')} onActiveItemChange={jest.fn()} />);

    expect(scrollIntoViewSpy.mock.instances[0]).toBe(getByTestId(`section-${QueryEditorType.Query}-C`));
    expect(scrollIntoViewSpy).toHaveBeenNthCalledWith(1, { block: 'start', behavior: 'smooth' });
  });

  it('follows the selection when it changes', () => {
    const items = [makeQueryItem('A'), makeQueryItem('B'), makeQueryItem('C')];
    const { getByTestId, rerender } = render(
      <Stack items={items} selectedItem={queryRef('A')} onActiveItemChange={jest.fn()} />
    );

    rerender(<Stack items={items} selectedItem={queryRef('C')} onActiveItemChange={jest.fn()} />);

    expect(scrollIntoViewSpy.mock.instances.at(-1)).toBe(getByTestId(`section-${QueryEditorType.Query}-C`));
  });

  it('re-pins the selected card as content resizes, so async-loaded sections cannot push it away', () => {
    const items = [makeQueryItem('A'), makeQueryItem('B'), makeQueryItem('C')];
    const { getByTestId } = render(<Stack items={items} selectedItem={queryRef('C')} onActiveItemChange={jest.fn()} />);

    // Flush the ResizeObserver callback — it re-pins the same target.
    jest.advanceTimersByTime(1);

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
    expect(scrollIntoViewSpy.mock.instances).toEqual([
      getByTestId(`section-${QueryEditorType.Query}-C`),
      getByTestId(`section-${QueryEditorType.Query}-C`),
    ]);
    // Re-pins are instant corrections, not animations — they must keep up with growing content.
    expect(scrollIntoViewSpy).toHaveBeenNthCalledWith(2, { block: 'start', behavior: 'auto' });
  });

  it('stops re-pinning once the user scrolls', () => {
    const items = [makeQueryItem('A'), makeQueryItem('B'), makeQueryItem('C')];
    const { getByTestId } = render(<Stack items={items} selectedItem={queryRef('C')} onActiveItemChange={jest.fn()} />);

    fireEvent.wheel(getByTestId('scroll-container'));
    jest.advanceTimersByTime(1);

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores scroll position while auto-following, then follows it after the user scrolls', () => {
    const items = [makeQueryItem('A'), makeQueryItem('B'), makeQueryItem('C')];
    const onActiveItemChange = jest.fn();
    const { getByTestId } = render(
      <Stack items={items} selectedItem={queryRef('A')} onActiveItemChange={onActiveItemChange} />
    );

    // Auto-following pins A: a transient dominant section must not change the selection.
    io.fireDominant('B');
    expect(onActiveItemChange).not.toHaveBeenCalled();

    // User takes over, then scrolls to a different card — selection now follows.
    fireEvent.wheel(getByTestId('scroll-container'));
    io.fireDominant('C');
    expect(onActiveItemChange).toHaveBeenCalledTimes(1);
    expect(onActiveItemChange).toHaveBeenLastCalledWith(queryRef('C'));
  });

  it('treats keyboard scrolling of the region as user intent, but not typing inside a section', () => {
    const items = [makeQueryItem('A'), makeQueryItem('B'), makeQueryItem('C')];
    const onActiveItemChange = jest.fn();
    const { getByTestId } = render(
      <Stack items={items} selectedItem={queryRef('A')} onActiveItemChange={onActiveItemChange} />
    );

    // A keystroke bubbling up from a section editor is typing, not scrolling: stay auto-following.
    fireEvent.keyDown(getByTestId(`section-${QueryEditorType.Query}-A`));
    io.fireDominant('B');
    expect(onActiveItemChange).not.toHaveBeenCalled();

    // A keystroke on the scroll region itself is keyboard scrolling: hand control to the observer.
    fireEvent.keyDown(getByTestId('scroll-container'));
    io.fireDominant('C');
    expect(onActiveItemChange).toHaveBeenCalledTimes(1);
    expect(onActiveItemChange).toHaveBeenLastCalledWith(queryRef('C'));
  });

  it('does not scroll back when the selection echoes a user scroll', () => {
    const items = [makeQueryItem('A'), makeQueryItem('B'), makeQueryItem('C')];
    const onActiveItemChange = jest.fn();
    const { getByTestId, rerender } = render(
      <Stack items={items} selectedItem={queryRef('A')} onActiveItemChange={onActiveItemChange} />
    );

    // User scrolls to B; the observer mirrors it into selection.
    fireEvent.wheel(getByTestId('scroll-container'));
    io.fireDominant('B');
    expect(onActiveItemChange).toHaveBeenLastCalledWith(queryRef('B'));

    // The parent now reports B as selected — that echo must not yank the view back to the top of B.
    const callsBeforeEcho = scrollIntoViewSpy.mock.calls.length;
    rerender(<Stack items={items} selectedItem={queryRef('B')} onActiveItemChange={onActiveItemChange} />);

    expect(scrollIntoViewSpy.mock.calls.length).toBe(callsBeforeEcho);
  });
});

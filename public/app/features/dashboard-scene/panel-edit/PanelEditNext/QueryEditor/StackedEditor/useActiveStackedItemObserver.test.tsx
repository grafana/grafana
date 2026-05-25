import { act, render } from '@testing-library/react';
import { type MutableRefObject, useRef } from 'react';

import { QueryEditorType } from '../../constants';
import { type StackedEditorItem } from '../QueryEditorContext';

import { useActiveStackedItemObserver } from './useActiveStackedItemObserver';

interface StackProps {
  items: ReadonlyArray<{ id: string; type: StackedEditorItem['type'] }>;
  itemsKey: string;
  onActiveItemChange: (item: StackedEditorItem) => void;
  pendingScrollKeyRef: MutableRefObject<string | null>;
}

function Stack({ items, itemsKey, onActiveItemChange, pendingScrollKeyRef }: StackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useActiveStackedItemObserver({ containerRef, itemsKey, onActiveItemChange, pendingScrollKeyRef });
  return (
    <div ref={containerRef}>
      {items.map(({ id, type }) => (
        <div key={`${type}:${id}`} data-stacked-editor-item-id={id} data-stacked-editor-item-type={type} />
      ))}
    </div>
  );
}

// Only the four fields the observer hook actually reads. Constructing a real
// IntersectionObserverEntry (with DOMRectReadOnly etc.) would be a lot of noise.
interface Entry {
  target: Element;
  isIntersecting: boolean;
  intersectionRatio: number;
  boundingClientRect: { top: number };
}

interface MockObserver {
  fire: (entries: Entry[]) => void;
  restore: () => void;
}

function mockIntersectionObserver(): MockObserver {
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

  // Cast once at the test/browser-API boundary — the hook only touches the constructor,
  // observe(), disconnect(), and the four Entry fields above.
  global.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;

  return {
    fire: (entries) => {
      act(() => {
        callback?.(entries as unknown as IntersectionObserverEntry[], {} as IntersectionObserver);
      });
    },
    restore: () => {
      global.IntersectionObserver = original;
    },
  };
}

function getSection(id: string, type: StackedEditorItem['type']): HTMLElement {
  const section = document.querySelector<HTMLElement>(
    `[data-stacked-editor-item-id="${id}"][data-stacked-editor-item-type="${type}"]`
  );
  if (!section) {
    throw new Error(`Section ${type}:${id} not found in test DOM`);
  }
  return section;
}

function makeEntry(target: Element, intersectionRatio: number, top: number): Entry {
  return {
    target,
    isIntersecting: intersectionRatio > 0,
    intersectionRatio,
    boundingClientRect: { top },
  };
}

const ITEMS: StackProps['items'] = [
  { id: 'A', type: QueryEditorType.Query },
  { id: 'B', type: QueryEditorType.Query },
  { id: 'organize-0', type: QueryEditorType.Transformation },
];
const ITEMS_KEY = `${QueryEditorType.Query}:A|${QueryEditorType.Query}:B|${QueryEditorType.Transformation}:organize-0`;

describe('useActiveStackedItemObserver', () => {
  let observer: MockObserver;

  beforeEach(() => {
    observer = mockIntersectionObserver();
  });

  afterEach(() => {
    observer.restore();
  });

  function renderStack(overrides: Partial<StackProps> = {}) {
    const onActiveItemChange = jest.fn();
    const pendingScrollKeyRef: MutableRefObject<string | null> = { current: null };
    render(
      <Stack
        items={ITEMS}
        itemsKey={ITEMS_KEY}
        onActiveItemChange={onActiveItemChange}
        pendingScrollKeyRef={pendingScrollKeyRef}
        {...overrides}
      />
    );
    return { onActiveItemChange, pendingScrollKeyRef };
  }

  it('reports the visible item with the highest intersection ratio as active', () => {
    const { onActiveItemChange } = renderStack();

    observer.fire([
      makeEntry(getSection('A', QueryEditorType.Query), 0.3, 0),
      makeEntry(getSection('B', QueryEditorType.Query), 0.9, 100),
    ]);

    expect(onActiveItemChange).toHaveBeenCalledTimes(1);
    expect(onActiveItemChange).toHaveBeenLastCalledWith({ type: QueryEditorType.Query, id: 'B' });
  });

  it('breaks ties on equal ratios by preferring the section closest to the top', () => {
    const { onActiveItemChange } = renderStack();

    observer.fire([
      makeEntry(getSection('A', QueryEditorType.Query), 1, 200),
      makeEntry(getSection('B', QueryEditorType.Query), 1, 50),
    ]);

    expect(onActiveItemChange).toHaveBeenLastCalledWith({ type: QueryEditorType.Query, id: 'B' });
  });

  it('does not re-notify when the active item is unchanged', () => {
    const { onActiveItemChange } = renderStack();

    observer.fire([makeEntry(getSection('A', QueryEditorType.Query), 1, 0)]);
    observer.fire([makeEntry(getSection('A', QueryEditorType.Query), 0.8, 0)]);

    expect(onActiveItemChange).toHaveBeenCalledTimes(1);
    expect(onActiveItemChange).toHaveBeenLastCalledWith({ type: QueryEditorType.Query, id: 'A' });
  });

  it('removes items from the visible set when they stop intersecting', () => {
    const { onActiveItemChange } = renderStack();

    // B starts dominant, then A becomes the only visible item.
    observer.fire([
      makeEntry(getSection('A', QueryEditorType.Query), 0.4, 0),
      makeEntry(getSection('B', QueryEditorType.Query), 0.9, 100),
    ]);
    expect(onActiveItemChange).toHaveBeenLastCalledWith({ type: QueryEditorType.Query, id: 'B' });

    observer.fire([makeEntry(getSection('B', QueryEditorType.Query), 0, 100)]);

    expect(onActiveItemChange).toHaveBeenLastCalledWith({ type: QueryEditorType.Query, id: 'A' });
  });

  it('suppresses sync while a pending scroll key is set until the target matches', () => {
    const { onActiveItemChange, pendingScrollKeyRef } = renderStack();
    pendingScrollKeyRef.current = `${QueryEditorType.Query}:B`;

    // Sections passed mid-scroll must not be reported as active.
    observer.fire([makeEntry(getSection('A', QueryEditorType.Query), 1, 0)]);
    expect(onActiveItemChange).not.toHaveBeenCalled();

    // Target reached: B is dominant. Sync resumes and the guard clears.
    observer.fire([
      makeEntry(getSection('A', QueryEditorType.Query), 0, 0),
      makeEntry(getSection('B', QueryEditorType.Query), 1, 0),
    ]);
    expect(onActiveItemChange).toHaveBeenLastCalledWith({ type: QueryEditorType.Query, id: 'B' });
    expect(pendingScrollKeyRef.current).toBeNull();

    // Subsequent intersections sync normally now that the guard is gone.
    observer.fire([
      makeEntry(getSection('B', QueryEditorType.Query), 0, 0),
      makeEntry(getSection('organize-0', QueryEditorType.Transformation), 1, 0),
    ]);
    expect(onActiveItemChange).toHaveBeenLastCalledWith({ type: QueryEditorType.Transformation, id: 'organize-0' });
  });

  it('ignores intersection entries on elements missing required data attributes', () => {
    const { onActiveItemChange } = renderStack();
    const stray = document.createElement('div');
    document.body.appendChild(stray);

    observer.fire([makeEntry(stray, 1, 0)]);

    expect(onActiveItemChange).not.toHaveBeenCalled();
    stray.remove();
  });
});

import { render } from '@testing-library/react';
import { useRef } from 'react';

import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { type StackedEditorItem } from '../QueryEditorContext';

import { useStackedItemScroll } from './useStackedItemScroll';
import { type StackedItem } from './utils';

interface StackProps {
  items: readonly StackedItem[];
  initialItem?: StackedEditorItem | null;
  onActiveItemChange: (item: StackedEditorItem) => void;
  setScrollHandler: (handler: ((item: StackedEditorItem) => void) | null) => void;
}

function Stack({ items, initialItem = null, onActiveItemChange, setScrollHandler }: StackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useStackedItemScroll({ containerRef, items, initialItem, onActiveItemChange, setScrollHandler });
  return (
    <div ref={containerRef}>
      {items.map((item) => (
        <div
          key={`${item.type}:${item.id}`}
          data-testid={`section-${item.type}-${item.id}`}
          data-stacked-editor-item-id={item.id}
          data-stacked-editor-item-type={item.type}
        />
      ))}
    </div>
  );
}

function captureScrollHandler() {
  let handler: ((item: StackedEditorItem) => void) | null = null;
  const setScrollHandler = jest.fn((next: ((item: StackedEditorItem) => void) | null) => {
    handler = next;
  });
  return { setScrollHandler, invoke: (item: StackedEditorItem) => handler?.(item) };
}

function makeQueryItem(refId: string): StackedItem {
  const query: DataQuery = { refId };
  return { type: QueryEditorType.Query, id: refId, query };
}

describe('useStackedItemScroll', () => {
  let scrollIntoViewSpy: jest.Mock;
  let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    // jsdom doesn't implement scrollIntoView.
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    scrollIntoViewSpy = jest.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('registers an imperative scroll handler at mount', () => {
    const { setScrollHandler } = captureScrollHandler();
    render(<Stack items={[makeQueryItem('A')]} onActiveItemChange={jest.fn()} setScrollHandler={setScrollHandler} />);

    expect(setScrollHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it('jumps to the initial item on mount without animation so the view opens on the selected card', () => {
    const { setScrollHandler } = captureScrollHandler();
    const items = [makeQueryItem('A'), makeQueryItem('B'), makeQueryItem('C')];
    const { getByTestId } = render(
      <Stack
        items={items}
        initialItem={{ type: QueryEditorType.Query, id: 'C' }}
        onActiveItemChange={jest.fn()}
        setScrollHandler={setScrollHandler}
      />
    );

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewSpy.mock.instances[0]).toBe(getByTestId(`section-${QueryEditorType.Query}-C`));
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
  });

  it('does not scroll on mount when there is no initial item', () => {
    const { setScrollHandler } = captureScrollHandler();
    render(
      <Stack
        items={[makeQueryItem('A'), makeQueryItem('B')]}
        initialItem={null}
        onActiveItemChange={jest.fn()}
        setScrollHandler={setScrollHandler}
      />
    );

    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it('scrolls the matching section into view when invoked', () => {
    const { setScrollHandler, invoke } = captureScrollHandler();
    const items = [makeQueryItem('A'), makeQueryItem('B')];
    const { getByTestId } = render(
      <Stack items={items} onActiveItemChange={jest.fn()} setScrollHandler={setScrollHandler} />
    );

    invoke({ type: QueryEditorType.Query, id: 'B' });

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewSpy.mock.instances[0]).toBe(getByTestId(`section-${QueryEditorType.Query}-B`));
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
  });

  it('is a no-op when no section matches the requested item', () => {
    const { setScrollHandler, invoke } = captureScrollHandler();
    render(<Stack items={[makeQueryItem('A')]} onActiveItemChange={jest.fn()} setScrollHandler={setScrollHandler} />);

    invoke({ type: QueryEditorType.Query, id: 'does-not-exist' });

    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it('matches on both id and type so transformations and queries with the same id are distinguished', () => {
    const { setScrollHandler, invoke } = captureScrollHandler();
    const items: StackedItem[] = [
      makeQueryItem('shared'),
      {
        type: QueryEditorType.Transformation,
        id: 'shared',
        transformation: {
          transformId: 'shared',
          transformConfig: { id: 'organize', options: {} },
          registryItem: undefined,
        },
      },
    ];
    const { getByTestId } = render(
      <Stack items={items} onActiveItemChange={jest.fn()} setScrollHandler={setScrollHandler} />
    );

    invoke({ type: QueryEditorType.Transformation, id: 'shared' });

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewSpy.mock.instances[0]).toBe(getByTestId(`section-${QueryEditorType.Transformation}-shared`));
  });
});

import { act, fireEvent, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { DashboardScene } from '../DashboardScene';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

type ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

let resizeObserverCallbacks: ResizeObserverCallback[] = [];

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    resizeObserverCallbacks.push(cb);
  }
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

function triggerResizeObservers() {
  act(() => {
    for (const cb of resizeObserverCallbacks) {
      cb([], {} as ResizeObserver);
    }
  });
}

function getScrollContainer() {
  // The tabs Droppable is the scroll container; hello-pangea/dnd tags it with this attribute.
  const el = document.querySelector<HTMLElement>('[data-rfd-droppable-id]');
  if (!el) {
    throw new Error('Scroll container not found');
  }
  return el;
}

function setContainerDimensions(
  el: HTMLElement,
  { scrollWidth, clientWidth, scrollLeft }: { scrollWidth: number; clientWidth: number; scrollLeft: number }
) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(el, 'scrollLeft', { configurable: true, value: scrollLeft, writable: true });
}

function buildManager(titles: string[]) {
  const tabs = titles.map((title, i) => new TabItem({ key: `tab-${i}`, title }));
  const manager = new TabsLayoutManager({ key: 'tabs-layout', tabs });
  new DashboardScene({ body: manager });
  return manager;
}

describe('TabsLayoutManagerRenderer scroll buttons', () => {
  const realResizeObserver = global.ResizeObserver;
  // jsdom does not implement scrollBy on Element; define it once so it can be spied on.
  const scrollByMock = jest.fn();

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      writable: true,
      value: scrollByMock,
    });
  });

  beforeEach(() => {
    resizeObserverCallbacks = [];
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    scrollByMock.mockReset();
  });

  afterEach(() => {
    global.ResizeObserver = realResizeObserver;
  });

  it('does not render scroll buttons when tabs fit the container', () => {
    const manager = buildManager(['Tab 1', 'Tab 2']);
    render(<manager.Component model={manager} />);

    setContainerDimensions(getScrollContainer(), { scrollWidth: 200, clientWidth: 400, scrollLeft: 0 });
    triggerResizeObservers();

    expect(screen.queryByLabelText('Scroll tabs left')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll tabs right')).not.toBeInTheDocument();
  });

  it('shows only the right button when overflow is ahead', () => {
    const manager = buildManager(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4']);
    render(<manager.Component model={manager} />);

    setContainerDimensions(getScrollContainer(), { scrollWidth: 800, clientWidth: 400, scrollLeft: 0 });
    triggerResizeObservers();

    expect(screen.queryByLabelText('Scroll tabs left')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Scroll tabs right')).toBeInTheDocument();
  });

  it('shows only the left button when scrolled fully to the right', () => {
    const manager = buildManager(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4']);
    render(<manager.Component model={manager} />);

    setContainerDimensions(getScrollContainer(), { scrollWidth: 800, clientWidth: 400, scrollLeft: 400 });
    triggerResizeObservers();

    expect(screen.getByLabelText('Scroll tabs left')).toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll tabs right')).not.toBeInTheDocument();
  });

  it('shows both buttons when scrolled somewhere in the middle', () => {
    const manager = buildManager(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4']);
    render(<manager.Component model={manager} />);

    setContainerDimensions(getScrollContainer(), { scrollWidth: 800, clientWidth: 400, scrollLeft: 200 });
    triggerResizeObservers();

    expect(screen.getByLabelText('Scroll tabs left')).toBeInTheDocument();
    expect(screen.getByLabelText('Scroll tabs right')).toBeInTheDocument();
  });

  it('scrolls the container when buttons are clicked', () => {
    const manager = buildManager(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4']);
    render(<manager.Component model={manager} />);

    const container = getScrollContainer();
    setContainerDimensions(container, { scrollWidth: 800, clientWidth: 400, scrollLeft: 200 });
    triggerResizeObservers();

    fireEvent.click(screen.getByLabelText('Scroll tabs right'));
    expect(scrollByMock).toHaveBeenLastCalledWith({ left: 400 * 0.8, behavior: 'smooth' });

    fireEvent.click(screen.getByLabelText('Scroll tabs left'));
    expect(scrollByMock).toHaveBeenLastCalledWith({ left: -(400 * 0.8), behavior: 'smooth' });
  });
});

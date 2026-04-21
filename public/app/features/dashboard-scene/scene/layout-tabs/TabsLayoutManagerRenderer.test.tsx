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

function buildManager(titles: string[], currentTabSlug?: string) {
  const tabs = titles.map((title, i) => new TabItem({ key: `tab-${i}`, title }));
  const manager = new TabsLayoutManager({ key: 'tabs-layout', tabs, currentTabSlug });
  new DashboardScene({ body: manager });
  return manager;
}

describe('TabsLayoutManagerRenderer scroll buttons', () => {
  const realResizeObserver = global.ResizeObserver;
  // jsdom does not implement scrollBy/scrollTo on Element; define once so they can be spied on.
  const scrollByMock = jest.fn();
  const scrollToMock = jest.fn();

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      writable: true,
      value: scrollByMock,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollToMock,
    });
  });

  beforeEach(() => {
    resizeObserverCallbacks = [];
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    scrollByMock.mockReset();
    scrollToMock.mockReset();
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

describe('TabsLayoutManagerRenderer active tab auto-scroll', () => {
  const realResizeObserver = global.ResizeObserver;
  const scrollByMock = jest.fn();
  const scrollToMock = jest.fn();

  // Matches theme.spacing.gridSize (8) * TAB_FADE_SPACING (6) in the renderer.
  const FADE_PX = 48;

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      writable: true,
      value: scrollByMock,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollToMock,
    });
  });

  beforeEach(() => {
    resizeObserverCallbacks = [];
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    scrollByMock.mockReset();
    scrollToMock.mockReset();
    // The scroll effect defers the actual scrollTo to the next animation frame.
    // Fake timers let the tests flush that deferred callback synchronously.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.ResizeObserver = realResizeObserver;
  });

  // Flush the requestAnimationFrame(s) scheduled by the scroll effect. jsdom
  // implements rAF via setTimeout under the hood, which Jest's fake timers
  // advance. The effect uses a double-rAF, so we need to run all timers until
  // the queue is empty (not just the currently-pending ones).
  function flushScrollFrame() {
    act(() => {
      jest.runAllTimers();
    });
  }

  // Stubs the tab's position relative to the scroll container in scroll-coordinate
  // space. The helper uses getBoundingClientRect for both, so we pair each tab
  // with the container's rect and derive matching viewport coordinates.
  function positionTabInScrollContainer(
    container: HTMLElement,
    tab: HTMLElement,
    { scrollOffset, width }: { scrollOffset: number; width: number }
  ) {
    const containerLeftInViewport = 50;
    container.getBoundingClientRect = () =>
      ({
        left: containerLeftInViewport,
        right: containerLeftInViewport + container.clientWidth,
        top: 0,
        bottom: 0,
        width: container.clientWidth,
        height: 0,
        x: containerLeftInViewport,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const tabLeftInViewport = containerLeftInViewport + (scrollOffset - container.scrollLeft);
    tab.getBoundingClientRect = () =>
      ({
        left: tabLeftInViewport,
        right: tabLeftInViewport + width,
        top: 0,
        bottom: 0,
        width,
        height: 0,
        x: tabLeftInViewport,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }

  it('scrolls an off-screen active tab into view, accounting for the fade region', () => {
    const manager = buildManager(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4']);
    render(<manager.Component model={manager} />);

    const container = getScrollContainer();
    setContainerDimensions(container, { scrollWidth: 800, clientWidth: 400, scrollLeft: 0 });

    const targetTab = manager.state.tabs[3].containerRef.current!;
    positionTabInScrollContainer(container, targetTab, { scrollOffset: 600, width: 100 });

    scrollToMock.mockReset();

    act(() => {
      manager.setState({ currentTabSlug: 'tab-4' });
    });
    flushScrollFrame();

    // tabRight (700) exceeds viewRight (400 - 48 = 352), so scrollTo targets
    // tabRight - clientWidth + fadePx = 700 - 400 + 48 = 348, clamped to max (400).
    expect(scrollToMock).toHaveBeenCalledWith({ left: 348, behavior: 'smooth' });
  });

  it('scrolls an active tab hidden behind the left fade back into view', () => {
    const manager = buildManager(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4']);
    render(<manager.Component model={manager} />);

    const container = getScrollContainer();
    setContainerDimensions(container, { scrollWidth: 800, clientWidth: 400, scrollLeft: 300 });

    const targetTab = manager.state.tabs[1].containerRef.current!;
    // Sits at scrollLeft 320, fully visible numerically but obscured by the fade margin.
    positionTabInScrollContainer(container, targetTab, { scrollOffset: 320, width: 40 });

    scrollToMock.mockReset();

    act(() => {
      manager.setState({ currentTabSlug: 'tab-2' });
    });
    flushScrollFrame();

    // tabLeft (320) < viewLeft (300 + 48 = 348) → target = tabLeft - fadePx = 272.
    expect(scrollToMock).toHaveBeenCalledWith({ left: 272, behavior: 'smooth' });
  });

  it('does not scroll when the active tab is already inside the non-faded window', () => {
    const manager = buildManager(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4']);
    render(<manager.Component model={manager} />);

    const container = getScrollContainer();
    setContainerDimensions(container, { scrollWidth: 800, clientWidth: 400, scrollLeft: 0 });

    const targetTab = manager.state.tabs[1].containerRef.current!;
    // [100, 180] is fully within [48, 352].
    positionTabInScrollContainer(container, targetTab, { scrollOffset: 100, width: 80 });

    scrollToMock.mockReset();

    act(() => {
      manager.setState({ currentTabSlug: 'tab-2' });
    });
    flushScrollFrame();

    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('scrolls to a freshly added tab that is past the visible area', () => {
    const manager = buildManager(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4']);
    render(<manager.Component model={manager} />);

    const container = getScrollContainer();
    setContainerDimensions(container, { scrollWidth: 900, clientWidth: 400, scrollLeft: 0 });

    scrollToMock.mockReset();

    const newTab = new TabItem({ key: 'tab-new', title: 'New Tab' });

    act(() => {
      manager.setState({
        tabs: [...manager.state.tabs, newTab],
        currentTabSlug: newTab.getSlug(),
      });
    });

    // After commit, the new tab's ref is attached by React. Stub its rect so
    // the rAF callback finds a meaningful position.
    const newTabEl = newTab.containerRef.current!;
    expect(newTabEl).not.toBeNull();
    positionTabInScrollContainer(container, newTabEl, { scrollOffset: 820, width: 80 });

    flushScrollFrame();

    // tabLeftInScroll = 820, tabRightInScroll = 900. viewRight = 352, so target =
    // 900 - 400 + 48 = 548, clamped to max (900 - 400 = 500).
    expect(scrollToMock).toHaveBeenCalledWith({ left: 500, behavior: 'smooth' });
  });

  it('clamps the scroll target to the container scroll range', () => {
    const manager = buildManager(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4'], 'tab-3');
    render(<manager.Component model={manager} />);

    const container = getScrollContainer();
    setContainerDimensions(container, { scrollWidth: 800, clientWidth: 400, scrollLeft: 300 });

    const targetTab = manager.state.tabs[0].containerRef.current!;
    // Tab at the very start; scrolling back would go negative but should clamp to 0.
    positionTabInScrollContainer(container, targetTab, { scrollOffset: 0, width: 80 });

    scrollToMock.mockReset();

    act(() => {
      manager.setState({ currentTabSlug: 'tab-1' });
    });
    flushScrollFrame();

    expect(scrollToMock).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
    // Sanity-check the fade constant used by the assertions above stays in sync with the renderer.
    expect(FADE_PX).toBe(48);
  });
});

import { selectors } from '@grafana/e2e-selectors';

import {
  AUTO_SCROLL_EDGE_PX,
  AUTO_SCROLL_MAX_SPEED_PX,
  DragAutoScroller,
  getAutoScrollSpeed,
  getAxisScrollSpeed,
  getDashboardScrollContainer,
} from './dragAutoScroll';

describe('getAutoScrollSpeed', () => {
  it('does not scroll outside of the edge zone', () => {
    expect(getAutoScrollSpeed(AUTO_SCROLL_EDGE_PX)).toBe(0);
    expect(getAutoScrollSpeed(AUTO_SCROLL_EDGE_PX + 200)).toBe(0);
  });

  it('scrolls faster the closer the pointer is to the edge, and at full speed at the edge and past it', () => {
    const speeds = [AUTO_SCROLL_EDGE_PX - 1, 60, 40, 20, 0].map((distance) => getAutoScrollSpeed(distance));

    expect(speeds[0]).toBe(1);
    speeds.slice(1).forEach((speed, index) => expect(speed).toBeGreaterThan(speeds[index]));
    expect(getAutoScrollSpeed(0)).toBe(AUTO_SCROLL_MAX_SPEED_PX);
    expect(getAutoScrollSpeed(-300)).toBe(AUTO_SCROLL_MAX_SPEED_PX);
  });

  it('grows with the square of the depth into the edge zone', () => {
    // Halfway into the zone is a quarter of the full speed
    expect(getAutoScrollSpeed(40, 80, 24)).toBe(6);
  });
});

describe('getAxisScrollSpeed', () => {
  it('scrolls back near the start, forward near the end, and not in between', () => {
    expect(getAxisScrollSpeed(10, 0, 1000, 80)).toBeLessThan(0);
    expect(getAxisScrollSpeed(990, 0, 1000, 80)).toBeGreaterThan(0);
    expect(getAxisScrollSpeed(500, 0, 1000, 80)).toBe(0);
  });

  it('keeps the edge zones to a third of a small container each, so its middle never scrolls', () => {
    expect(getAxisScrollSpeed(50, 0, 90, 80)).toBe(0);
    expect(getAxisScrollSpeed(70, 0, 90, 80)).toBeGreaterThan(0);
  });
});

describe('DragAutoScroller', () => {
  let frames: FrameRequestCallback[] = [];
  const originalElementsFromPoint = document.elementsFromPoint;

  beforeEach(() => {
    frames = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      frames[id - 1] = () => {};
    });
    document.elementsFromPoint = () => [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.elementsFromPoint = originalElementsFromPoint;
    document.body.innerHTML = '';
  });

  function runFrame() {
    const pending = frames;
    frames = [];
    pending.forEach((callback) => callback(0));
  }

  function runAllFrames() {
    for (let i = 0; i < 50 && frames.length > 0; i++) {
      runFrame();
    }
  }

  it('finds the dashboard body as the scroll container, and the document without it', () => {
    expect(getDashboardScrollContainer()).toBe(document.documentElement);

    const body = renderScrollContainer({ scrollHeight: 3000 });

    expect(getDashboardScrollContainer()).toBe(body);
  });

  it('scrolls the dashboard down every frame while the pointer is near its bottom edge, until the content ends', () => {
    const body = renderScrollContainer({ top: 100, height: 600, scrollHeight: 700 });
    const onScroll = jest.fn();
    const scroller = new DragAutoScroller({ onScroll });
    scroller.start(400, 300);

    // At the edge itself: full speed
    scroller.update(400, 700);
    runFrame();
    expect(body.scrollTop).toBe(AUTO_SCROLL_MAX_SPEED_PX);
    runAllFrames();

    // 100px of content below the fold: it stops at the end, after re-running the drag logic once per step
    expect(body.scrollTop).toBe(100);
    expect(onScroll).toHaveBeenCalledTimes(Math.ceil(100 / AUTO_SCROLL_MAX_SPEED_PX));
    expect(frames).toHaveLength(0);
  });

  it('scrolls up near the top edge', () => {
    const body = renderScrollContainer({ top: 100, height: 600, scrollHeight: 2000, scrollTop: 500 });
    const scroller = new DragAutoScroller({ onScroll: jest.fn() });
    scroller.start(400, 300);

    scroller.update(400, 110);
    runFrame();

    expect(body.scrollTop).toBeLessThan(500);
  });

  it('re-runs the drag logic after each scroll step, before the next frame is painted', () => {
    const body = renderScrollContainer({ top: 0, height: 600, scrollHeight: 2000 });
    const scrollTops: number[] = [];
    const scroller = new DragAutoScroller({ onScroll: () => scrollTops.push(body.scrollTop) });
    scroller.start(400, 300);

    scroller.update(400, 590);
    runFrame();
    runFrame();

    expect(scrollTops).toHaveLength(2);
    expect(scrollTops[1]).toBeGreaterThan(scrollTops[0]);
  });

  it('does not scroll before the pointer moved away from where it was pressed, so a click never scrolls', () => {
    const body = renderScrollContainer({ top: 0, height: 600, scrollHeight: 2000 });
    const scroller = new DragAutoScroller({ onScroll: jest.fn() });
    scroller.start(400, 590);

    scroller.update(401, 591);
    runFrame();
    expect(body.scrollTop).toBe(0);

    scroller.update(400, 595);
    runFrame();
    expect(body.scrollTop).toBeGreaterThan(0);
  });

  it('does not scroll while the pointer is beside the dashboard, e.g. over the edit pane', () => {
    const body = renderScrollContainer({ top: 0, height: 600, width: 800, scrollHeight: 2000 });
    const scroller = new DragAutoScroller({ onScroll: jest.fn() });
    scroller.start(900, 300);

    scroller.update(900, 595);
    runFrame();

    expect(body.scrollTop).toBe(0);
  });

  it('stops scrolling once the pointer leaves the edge, and when stopped', () => {
    const body = renderScrollContainer({ top: 0, height: 600, scrollHeight: 5000 });
    const scroller = new DragAutoScroller({ onScroll: jest.fn() });
    scroller.start(400, 300);
    scroller.update(400, 595);
    runFrame();
    const scrolled = body.scrollTop;

    scroller.update(400, 300);
    runFrame();
    expect(body.scrollTop).toBe(scrolled);
    expect(frames).toHaveLength(0);

    scroller.update(400, 595);
    scroller.stop();
    runFrame();
    expect(body.scrollTop).toBe(scrolled);
  });

  it('scrolls a tab bar that does not fit its tabs sideways when asked to', () => {
    renderScrollContainer({ top: 0, height: 600, scrollHeight: 600 });
    const tabBar = renderHorizontalScroller({ left: 0, width: 500, scrollWidth: 1200 });
    document.elementsFromPoint = () => [tabBar];
    const scroller = new DragAutoScroller({ onScroll: jest.fn(), horizontal: true });
    scroller.start(250, 16);

    scroller.update(495, 16);
    runFrame();
    expect(tabBar.scrollLeft).toBeGreaterThan(0);
    scroller.stop();

    const pageOnly = new DragAutoScroller({ onScroll: jest.fn() });
    const before = tabBar.scrollLeft;
    pageOnly.start(250, 16);
    pageOnly.update(495, 16);
    runFrame();
    expect(tabBar.scrollLeft).toBe(before);
  });

  it('re-runs the drag logic when the user scrolls during the drag, but not twice for its own scroll steps', () => {
    const body = renderScrollContainer({ top: 0, height: 600, scrollHeight: 2000 });
    const onScroll = jest.fn();
    const scroller = new DragAutoScroller({ onScroll });
    scroller.start(400, 300);
    scroller.update(400, 595);
    runFrame();
    expect(onScroll).toHaveBeenCalledTimes(1);

    body.dispatchEvent(new Event('scroll'));
    expect(onScroll).toHaveBeenCalledTimes(1);

    // e.g. the mouse wheel
    body.scrollTop += 100;
    body.dispatchEvent(new Event('scroll'));
    expect(onScroll).toHaveBeenCalledTimes(2);

    scroller.stop();
    body.scrollTop += 100;
    body.dispatchEvent(new Event('scroll'));
    expect(onScroll).toHaveBeenCalledTimes(2);
  });
});

interface ScrollBox {
  top?: number;
  height?: number;
  width?: number;
  scrollHeight: number;
  scrollTop?: number;
}

/** The dashboard body, which scrolls between 0 and `scrollHeight - height` like a browser clamps it */
function renderScrollContainer({ top = 0, height = 600, width = 1000, scrollHeight, scrollTop = 0 }: ScrollBox) {
  const element = document.createElement('div');
  element.setAttribute('data-testid', selectors.components.DashboardSidebarSplitter.bodyContainer);
  let position = scrollTop;
  Object.defineProperties(element, {
    clientHeight: { value: height },
    scrollHeight: { value: scrollHeight },
    scrollTop: {
      get: () => position,
      set: (value: number) => (position = Math.min(Math.max(value, 0), scrollHeight - height)),
    },
  });
  element.getBoundingClientRect = () => rect(top, height, 0, width);
  document.body.appendChild(element);
  return element;
}

function renderHorizontalScroller({ left, width, scrollWidth }: { left: number; width: number; scrollWidth: number }) {
  const element = document.createElement('div');
  element.style.overflowX = 'auto';
  let position = 0;
  Object.defineProperties(element, {
    clientWidth: { value: width },
    scrollWidth: { value: scrollWidth },
    scrollLeft: {
      get: () => position,
      set: (value: number) => (position = Math.min(Math.max(value, 0), scrollWidth - width)),
    },
  });
  element.getBoundingClientRect = () => rect(0, 32, left, width);
  document.body.appendChild(element);
  return element;
}

function rect(top: number, height: number, left: number, width: number): DOMRect {
  const box = { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height };
  return { ...box, toJSON: () => box };
}

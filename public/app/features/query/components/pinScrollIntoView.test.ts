import { pinScrollIntoView, SCROLL_PIN_SETTLE_MS } from './pinScrollIntoView';

class MockResizeObserver implements ResizeObserver {
  static instances: MockResizeObserver[] = [];

  observedTargets: Element[] = [];
  disconnected = false;

  constructor(public callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observedTargets.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  unobserve() {}

  /**
   * Delivers an observation. Real observers stop delivering after disconnect(), so mirror that —
   * it's what lets a test prove pinning actually stopped rather than only that disconnect() ran.
   */
  fire(height: number) {
    if (this.disconnected) {
      return;
    }
    this.callback([{ contentRect: { height } } as ResizeObserverEntry], this);
  }
}

describe('pinScrollIntoView', () => {
  let scrollIntoViewSpy: jest.Mock;
  let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(() => {
    jest.useFakeTimers();
    // jsdom doesn't implement scrollIntoView, so patch the prototype rather than spy on it.
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    scrollIntoViewSpy = jest.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;

    originalResizeObserver = global.ResizeObserver;
    MockResizeObserver.instances = [];
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    jest.useRealTimers();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    global.ResizeObserver = originalResizeObserver;
  });

  // jsdom's getBoundingClientRect returns 0, so the baseline height measured at pin start is 0.
  function setup() {
    const parent = document.createElement('div');
    const element = document.createElement('div');
    parent.appendChild(element);
    document.body.appendChild(parent);

    const cancel = pinScrollIntoView(element);
    const observer = MockResizeObserver.instances[MockResizeObserver.instances.length - 1];

    return {
      element,
      parent,
      cancel,
      observer,
      fireResize: (height: number) => observer.fire(height),
    };
  }

  it('scrolls the element into view immediately, animating the deliberate navigation', () => {
    const { element, parent, observer } = setup();

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewSpy.mock.instances[0]).toBe(element);
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    // Observes the parent: siblings growing change the parent's size, not the element's.
    expect(observer.observedTargets).toEqual([parent]);
  });

  it('ignores observations where the height has not changed, so the animation is not cut short by no-op re-pins', () => {
    const { fireResize } = setup();

    // ResizeObserver's initial observation right after observe(), with nothing grown yet.
    fireResize(0);

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
  });

  it('re-pins on the initial observation when content already grew in the same frame (cached editors on a re-add)', () => {
    const { element, fireResize } = setup();

    fireResize(300);

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
    expect(scrollIntoViewSpy.mock.instances[1]).toBe(element);
    // Smooth, so the correction re-targets the in-flight animation instead of jump-cutting.
    expect(scrollIntoViewSpy).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('re-pins as the surrounding content keeps growing', () => {
    const { element, fireResize } = setup();

    fireResize(100);
    fireResize(200);

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(3);
    expect(scrollIntoViewSpy.mock.instances[2]).toBe(element);
    expect(scrollIntoViewSpy).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('does not re-pin when consecutive observations report the same height', () => {
    const { fireResize } = setup();

    fireResize(100);
    fireResize(100);

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps re-pinning right up to the end of the settle window, then stops', () => {
    const { fireResize, observer } = setup();

    jest.advanceTimersByTime(SCROLL_PIN_SETTLE_MS - 1);
    expect(observer.disconnected).toBe(false);
    fireResize(100);
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);

    // The re-pin restarted the window, so the pin only ends a full window after the last growth.
    jest.advanceTimersByTime(SCROLL_PIN_SETTLE_MS - 1);
    expect(observer.disconnected).toBe(false);

    jest.advanceTimersByTime(1);
    expect(observer.disconnected).toBe(true);
    fireResize(200);
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
  });

  it('stops pinning on the first user scroll gesture, leaving deliberate navigation alone', () => {
    const { fireResize, observer } = setup();

    window.dispatchEvent(new Event('wheel'));

    expect(observer.disconnected).toBe(true);
    // Content that grows after the handover must not drag the viewport back to the element.
    fireResize(400);
    jest.advanceTimersByTime(SCROLL_PIN_SETTLE_MS);
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
  });

  it('cancel stops pinning', () => {
    const { cancel, fireResize, observer } = setup();

    cancel();

    expect(observer.disconnected).toBe(true);
    fireResize(400);
    jest.advanceTimersByTime(SCROLL_PIN_SETTLE_MS);
    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
  });

  it('supersedes an outstanding pin, so two pins never fight over the viewport', () => {
    const first = setup();
    const second = setup();

    expect(first.observer.disconnected).toBe(true);
    expect(second.observer.disconnected).toBe(false);

    // Growth now moves the viewport to the newest target only.
    first.fireResize(300);
    second.fireResize(300);

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(3);
    expect(scrollIntoViewSpy.mock.instances[2]).toBe(second.element);
  });

  it('a superseded pin cancelling late leaves the live pin, and the next pin still supersedes it', () => {
    const first = setup();
    const second = setup();

    // The superseded row cleaning up late (its row unmounting) must neither stop the pin that
    // replaced it nor detach that pin from the viewport.
    first.cancel();
    expect(second.observer.disconnected).toBe(false);

    const third = setup();

    expect(second.observer.disconnected).toBe(true);
    expect(third.observer.disconnected).toBe(false);
    third.fireResize(300);
    expect(scrollIntoViewSpy.mock.instances[3]).toBe(third.element);
  });
});

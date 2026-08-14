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

  function setup() {
    const parent = document.createElement('div');
    const element = document.createElement('div');
    parent.appendChild(element);
    document.body.appendChild(parent);

    const onDone = jest.fn();
    const cancel = pinScrollIntoView(element, onDone);
    const observer = MockResizeObserver.instances[0];

    return {
      element,
      parent,
      onDone,
      cancel,
      observer,
      // Simulates a ResizeObserver callback reporting the observed target at `height`. jsdom's
      // getBoundingClientRect returns 0, so the baseline height measured at pin start is 0.
      fireResize: (height: number) => observer.callback([{ contentRect: { height } } as ResizeObserverEntry], observer),
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

  it('reports done once the layout stays quiet for the settle window', () => {
    const { onDone, observer } = setup();

    jest.advanceTimersByTime(SCROLL_PIN_SETTLE_MS - 1);
    expect(onDone).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(observer.disconnected).toBe(true);
  });

  it('restarts the settle window on every height change', () => {
    const { onDone, fireResize } = setup();

    fireResize(100);
    jest.advanceTimersByTime(SCROLL_PIN_SETTLE_MS - 1);
    fireResize(200);
    jest.advanceTimersByTime(SCROLL_PIN_SETTLE_MS - 1);
    expect(onDone).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stops pinning and reports done on the first user scroll gesture', () => {
    const { onDone, observer } = setup();

    window.dispatchEvent(new Event('wheel'));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(observer.disconnected).toBe(true);

    // The settle timer must not report done a second time.
    jest.advanceTimersByTime(SCROLL_PIN_SETTLE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancel stops pinning without reporting done', () => {
    const { onDone, cancel, observer } = setup();

    cancel();

    jest.advanceTimersByTime(SCROLL_PIN_SETTLE_MS);
    window.dispatchEvent(new Event('wheel'));

    expect(onDone).not.toHaveBeenCalled();
    expect(observer.disconnected).toBe(true);
  });
});

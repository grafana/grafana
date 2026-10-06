import {
  HEARTBEAT_MS,
  LINK_MIN_INTERVAL_MS,
  MAX_FRAME_MESSAGES_PER_SECOND,
  RENDER_TIMEOUT_MS,
  STARTUP_TIMEOUT_MS,
  UNRESPONSIVE_MS,
} from './constants';
import { createRenderFrameController, type PortLike, type RenderFrameHandlers } from './controller';
import type { RenderInput } from './protocol';

interface FakeHostPort extends PortLike {
  sent: unknown[];
  closed: boolean;
}

function setup() {
  const port: FakeHostPort = {
    sent: [],
    closed: false,
    onmessage: null,
    postMessage(message) {
      port.sent.push(message);
    },
    start: jest.fn(),
    close() {
      port.closed = true;
    },
  };
  const transferred = { id: 'port2' } as unknown as Transferable;
  const handlers: jest.Mocked<RenderFrameHandlers> = {
    onReady: jest.fn(),
    onRenderComplete: jest.fn(),
    onHeight: jest.fn(),
    onError: jest.fn(),
    onLink: jest.fn(),
  };
  const controller = createRenderFrameController(handlers, {
    createChannel: () => ({ port1: port, port2: transferred }),
    now: () => Date.now(),
  });
  const postMessage = jest.fn();
  const iframe = { contentWindow: { postMessage } } as unknown as HTMLIFrameElement;
  const fromFrame = (data: unknown) => port.onmessage?.({ data });
  const connect = () => {
    controller.handleLoad(iframe);
    fromFrame({ type: 'ready', version: 1 });
  };
  return { port, transferred, handlers, controller, iframe, postMessage, fromFrame, connect };
}

const input = (width = 100) => ({ size: { width, height: 50 } }) as unknown as RenderInput;

describe('createRenderFrameController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('posts the init message with one port and no data on the first load', () => {
    const { controller, iframe, postMessage, transferred, port } = setup();
    controller.handleLoad(iframe);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: 'grafana-render:init', version: 1 }, '*', [transferred]);
    expect(port.start).toHaveBeenCalled();
    expect(controller.getState()).toBe('connecting');
  });

  it('queues only the latest render before ready and sends it on ready', () => {
    const { controller, iframe, port, fromFrame, handlers } = setup();
    controller.handleLoad(iframe);
    expect(controller.render(input(1))).toBe(1);
    expect(controller.render(input(2))).toBe(2);
    expect(controller.resize({ width: 3, height: 4 })).toBe(3);
    expect(port.sent).toEqual([]);

    fromFrame({ type: 'ready', version: 1 });
    expect(handlers.onReady).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toBe('ready');
    expect(port.sent).toEqual([{ type: 'render', seq: 3, input: { size: { width: 3, height: 4 } } }]);
  });

  it('sends resize with a shared, increasing seq after ready', () => {
    const { controller, port, connect } = setup();
    connect();
    controller.render(input());
    controller.resize({ width: 10, height: 20 });
    expect(port.sent).toEqual([
      { type: 'render', seq: 1, input: input() },
      { type: 'resize', seq: 2, size: { width: 10, height: 20 } },
    ]);
  });

  it('fails fatally when the frame never reports ready', () => {
    const { controller, iframe, handlers, port } = setup();
    controller.handleLoad(iframe);
    jest.advanceTimersByTime(STARTUP_TIMEOUT_MS);
    expect(handlers.onError).toHaveBeenCalledWith({
      kind: 'startup-timeout',
      message: 'The panel frame did not start within 15 seconds.',
      fatal: true,
    });
    expect(controller.getState()).toBe('failed');
    expect(port.closed).toBe(true);
    expect(controller.render(input())).toBe(-1);
  });

  it('judges a frame unresponsive only after it answered a ping', () => {
    const { handlers, port, fromFrame, connect } = setup();
    connect();
    // Never answering: no verdict, however long it takes.
    jest.advanceTimersByTime(UNRESPONSIVE_MS * 3);
    expect(handlers.onError).not.toHaveBeenCalled();

    const pings = port.sent.filter((message) => Reflect.get(Object(message), 'type') === 'ping');
    const lastPing = pings[pings.length - 1];
    fromFrame({ type: 'pong', id: Reflect.get(Object(lastPing), 'id') });
    jest.advanceTimersByTime(UNRESPONSIVE_MS + HEARTBEAT_MS * 2);
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'unresponsive', fatal: true }));
    expect(port.closed).toBe(true);
  });

  it('reports a render timeout as non-fatal and keeps the controller ready', () => {
    const { controller, handlers, connect } = setup();
    connect();
    const seq = controller.render(input());
    jest.advanceTimersByTime(RENDER_TIMEOUT_MS);
    expect(handlers.onError).toHaveBeenCalledWith({
      kind: 'render-timeout',
      message: 'The panel code did not finish drawing within 10 seconds.',
      seq,
      fatal: false,
    });
    expect(controller.getState()).toBe('ready');
  });

  it('clears the render timer when the frame completes that seq', () => {
    const { controller, handlers, connect, fromFrame } = setup();
    connect();
    const seq = controller.render(input());
    fromFrame({ type: 'render-complete', seq, durationMs: 3, nodeCount: 5 });
    jest.advanceTimersByTime(RENDER_TIMEOUT_MS * 2);
    expect(handlers.onRenderComplete).toHaveBeenCalledWith({ seq, durationMs: 3, nodeCount: 5 });
    expect(handlers.onError).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'render-timeout' }));
  });

  it('forwards frame errors as non-fatal', () => {
    const { handlers, connect, fromFrame, controller } = setup();
    connect();
    fromFrame({ type: 'error', kind: 'csp', message: 'connect-src https://x', seq: 1 });
    expect(handlers.onError).toHaveBeenCalledWith({
      kind: 'csp',
      message: 'connect-src https://x',
      seq: 1,
      fatal: false,
    });
    expect(controller.getState()).toBe('ready');
  });

  it.each([
    ['an unknown type', { type: 'navigate', path: '/admin' }],
    ['a height over the limit', { type: 'height', height: 10_001 }],
    ['an oversized link', { type: 'link', href: 'x'.repeat(2049) }],
    ['a wrong ready version', { type: 'ready', version: 2 }],
  ])('fails with a protocol error on %s', (_, message) => {
    const { handlers, connect, fromFrame, controller, port } = setup();
    connect();
    fromFrame(message);
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'protocol', fatal: true }));
    expect(controller.getState()).toBe('failed');
    expect(port.onmessage).toBeNull();
  });

  it('drops non-object messages without failing', () => {
    const { handlers, connect, fromFrame, controller } = setup();
    connect();
    fromFrame('ready');
    fromFrame([{ type: 'ready', version: 1 }]);
    fromFrame(null);
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(controller.getState()).toBe('ready');
  });

  it('fails with rate-limit when the frame floods the host', () => {
    const { handlers, connect, fromFrame, controller } = setup();
    connect();
    // Let the 'ready' message leave the window.
    jest.advanceTimersByTime(1000);
    for (let i = 0; i <= MAX_FRAME_MESSAGES_PER_SECOND; i++) {
      fromFrame({ type: 'height', height: i });
    }
    expect(handlers.onHeight).toHaveBeenCalledTimes(MAX_FRAME_MESSAGES_PER_SECOND);
    expect(handlers.onError).toHaveBeenCalledWith({
      kind: 'rate-limit',
      message: `The panel frame sent more than ${MAX_FRAME_MESSAGES_PER_SECOND} messages in one second (${MAX_FRAME_MESSAGES_PER_SECOND + 1} height).`,
      fatal: true,
    });
    expect(controller.getState()).toBe('failed');
  });

  it('admits messages again once the one-second window slides', () => {
    const { handlers, connect, fromFrame } = setup();
    connect();
    jest.advanceTimersByTime(1000);
    for (let i = 0; i < MAX_FRAME_MESSAGES_PER_SECOND; i++) {
      fromFrame({ type: 'height', height: i });
    }
    jest.advanceTimersByTime(1000);
    fromFrame({ type: 'height', height: 1 });
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('drops links that arrive within the minimum interval', () => {
    const { handlers, connect, fromFrame } = setup();
    connect();
    fromFrame({ type: 'link', href: '#panel-1' });
    fromFrame({ type: 'link', href: '#panel-2' });
    jest.advanceTimersByTime(LINK_MIN_INTERVAL_MS);
    fromFrame({ type: 'link', href: '#panel-3' });
    expect(handlers.onLink.mock.calls).toEqual([['#panel-1'], ['#panel-3']]);
  });

  it('treats a second load of the frame as navigated-away', () => {
    const { controller, iframe, handlers, connect, postMessage, port } = setup();
    connect();
    controller.handleLoad(iframe);
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'navigated-away', fatal: true }));
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(port.closed).toBe(true);
  });

  it('stops the heartbeat and render timer while paused and resumes them', () => {
    const { controller, port, connect, handlers } = setup();
    connect();
    controller.render(input());
    controller.pause();
    expect(port.sent[port.sent.length - 1]).toEqual({ type: 'pause' });
    const sentWhilePaused = port.sent.length;
    jest.advanceTimersByTime(RENDER_TIMEOUT_MS * 2);
    expect(port.sent).toHaveLength(sentWhilePaused);
    expect(handlers.onError).not.toHaveBeenCalled();

    controller.resume();
    expect(port.sent[port.sent.length - 1]).toEqual({ type: 'resume' });
    jest.advanceTimersByTime(RENDER_TIMEOUT_MS);
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'render-timeout' }));
  });

  it('clears every timer and the port on dispose, and is idempotent', () => {
    const { controller, port, connect } = setup();
    connect();
    controller.render(input());
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    controller.dispose();
    controller.dispose();
    expect(jest.getTimerCount()).toBe(0);
    expect(port.closed).toBe(true);
    expect(controller.getState()).toBe('disposed');
    expect(controller.render(input())).toBe(-1);
  });
});

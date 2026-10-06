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

function lastPingId(port: FakeHostPort): number {
  const pings = port.sent.filter((message) => Reflect.get(Object(message), 'type') === 'ping');
  return pings.length === 0 ? 0 : Number(Reflect.get(Object(pings[pings.length - 1]), 'id'));
}

/** Advances time like a frame that answers every ping but may never finish a draw. */
function advanceAnswering(ms: number, port: FakeHostPort, fromFrame: (data: unknown) => void) {
  let answered = lastPingId(port);
  for (let elapsed = 0; elapsed < ms; elapsed += HEARTBEAT_MS) {
    jest.advanceTimersByTime(Math.min(HEARTBEAT_MS, ms - elapsed));
    const id = lastPingId(port);
    if (id > answered) {
      fromFrame({ type: 'pong', id });
      answered = id;
    }
  }
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

  it('fails a frame that never answers its first ping, stuck in its first draw', () => {
    const { controller, handlers, port, connect } = setup();
    connect();
    controller.render(input());
    jest.advanceTimersByTime(UNRESPONSIVE_MS);
    expect(handlers.onError).not.toHaveBeenCalled();

    jest.advanceTimersByTime(HEARTBEAT_MS * 2);
    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onError).toHaveBeenCalledWith({
      kind: 'unresponsive',
      message: `The panel code stopped responding for more than ${UNRESPONSIVE_MS / 1000} seconds, for example because of a loop that never ends.`,
      fatal: true,
    });
    expect(controller.getState()).toBe('failed');
    expect(port.closed).toBe(true);
    expect(port.onmessage).toBeNull();
    // Nothing is left running that could fire a second verdict or wedge the host.
    expect(jest.getTimerCount()).toBe(0);
    expect(controller.render(input())).toBe(-1);
  });

  it('fails a frame that answered and then stopped answering', () => {
    const { handlers, port, fromFrame, connect } = setup();
    connect();
    jest.advanceTimersByTime(HEARTBEAT_MS);
    fromFrame({ type: 'pong', id: lastPingId(port) });
    jest.advanceTimersByTime(UNRESPONSIVE_MS + HEARTBEAT_MS * 2);
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'unresponsive', fatal: true }));
    expect(port.closed).toBe(true);
  });

  it('keeps a frame that answers every ping', () => {
    const { controller, handlers, port, fromFrame, connect } = setup();
    connect();
    advanceAnswering(UNRESPONSIVE_MS * 4, port, fromFrame);
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(controller.getState()).toBe('ready');
  });

  it('does not judge the frame while the host document is hidden', () => {
    const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { controller, handlers, connect } = setup();
    connect();
    jest.advanceTimersByTime(UNRESPONSIVE_MS * 3);
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(controller.getState()).toBe('ready');

    hidden.mockReturnValue(false);
    jest.advanceTimersByTime(UNRESPONSIVE_MS + HEARTBEAT_MS * 2);
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'unresponsive', fatal: true }));
    hidden.mockRestore();
  });

  it('fails a frame that never loads', () => {
    const { controller, handlers } = setup();
    expect(controller.getState()).toBe('idle');
    jest.advanceTimersByTime(STARTUP_TIMEOUT_MS);
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'startup-timeout', fatal: true }));
    expect(controller.getState()).toBe('failed');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports a render timeout as non-fatal and keeps the controller ready', () => {
    const { controller, handlers, connect, port, fromFrame } = setup();
    connect();
    const seq = controller.render(input());
    advanceAnswering(RENDER_TIMEOUT_MS, port, fromFrame);
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

  it.each([
    ['a string', 'ready'],
    ['an array', [{ type: 'ready', version: 1 }]],
    ['null', null],
    ['a number', 42],
  ])('fails with a protocol error on %s instead of ignoring it', (_, message) => {
    const { handlers, connect, fromFrame, controller } = setup();
    connect();
    fromFrame(message);
    expect(handlers.onError).toHaveBeenCalledWith({
      kind: 'protocol',
      message: 'The panel frame sent a message that is not an object.',
      fatal: true,
    });
    expect(controller.getState()).toBe('failed');
  });

  it('fails with a protocol error on a valid message that carries extra payload', () => {
    const { handlers, connect, fromFrame, controller } = setup();
    connect();
    fromFrame({ type: 'height', height: 10, padding: 'x'.repeat(10_000) });
    expect(handlers.onHeight).not.toHaveBeenCalled();
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'protocol', fatal: true }));
    expect(controller.getState()).toBe('failed');
  });

  it('counts primitive messages toward the rate limit before parsing them', () => {
    const { handlers, connect, fromFrame, controller } = setup();
    connect();
    jest.advanceTimersByTime(1000);
    for (let i = 0; i < MAX_FRAME_MESSAGES_PER_SECOND; i++) {
      fromFrame({ type: 'height', height: i });
    }
    fromFrame('x'.repeat(1000));
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'rate-limit', fatal: true }));
    expect(controller.getState()).toBe('failed');
  });

  it('counts pongs toward the rate limit', () => {
    const { handlers, connect, fromFrame, controller, port } = setup();
    connect();
    jest.advanceTimersByTime(HEARTBEAT_MS);
    const ping = port.sent.find((message) => Reflect.get(Object(message), 'type') === 'ping');
    const id = Reflect.get(Object(ping), 'id');
    jest.advanceTimersByTime(1000);
    for (let i = 0; i < MAX_FRAME_MESSAGES_PER_SECOND; i++) {
      fromFrame({ type: 'height', height: i });
    }
    expect(controller.getState()).toBe('ready');
    // A valid answer to the outstanding ping is still one message too many.
    fromFrame({ type: 'pong', id });
    expect(handlers.onError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'rate-limit', message: expect.stringContaining('1 pong'), fatal: true })
    );
  });

  it('accepts one pong per ping and fails on a duplicate or a pong for a ping never sent', () => {
    const { handlers, connect, fromFrame, controller, port } = setup();
    connect();
    jest.advanceTimersByTime(HEARTBEAT_MS);
    const ping = port.sent.find((message) => Reflect.get(Object(message), 'type') === 'ping');
    const id = Number(Reflect.get(Object(ping), 'id'));

    fromFrame({ type: 'pong', id });
    expect(controller.getState()).toBe('ready');

    fromFrame({ type: 'pong', id });
    expect(handlers.onError).toHaveBeenCalledWith({
      kind: 'protocol',
      message: `The panel frame answered a heartbeat that was not sent (id ${id}).`,
      fatal: true,
    });
    expect(controller.getState()).toBe('failed');
  });

  it('fails on a pong with an id ahead of the last ping', () => {
    const { handlers, connect, fromFrame, controller } = setup();
    connect();
    jest.advanceTimersByTime(HEARTBEAT_MS);
    fromFrame({ type: 'pong', id: 999 });
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'protocol', fatal: true }));
    expect(controller.getState()).toBe('failed');
  });

  it('ignores a late pong for an earlier ping without counting it as an answer', () => {
    const { handlers, connect, fromFrame, controller, port } = setup();
    connect();
    jest.advanceTimersByTime(HEARTBEAT_MS);
    // A long host stall restarts the wait, so the next tick sends a new ping.
    jest.setSystemTime(Date.now() + HEARTBEAT_MS * 4);
    jest.advanceTimersByTime(HEARTBEAT_MS);
    const pings = port.sent.filter((message) => Reflect.get(Object(message), 'type') === 'ping');
    expect(pings.length).toBeGreaterThanOrEqual(2);

    fromFrame({ type: 'pong', id: Reflect.get(Object(pings[0]), 'id') });
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
    const { controller, port, connect, handlers, fromFrame } = setup();
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
    advanceAnswering(RENDER_TIMEOUT_MS, port, fromFrame);
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

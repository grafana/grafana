import {
  HEARTBEAT_MS,
  LINK_MIN_INTERVAL_MS,
  MAX_DIAGNOSTIC_LENGTH,
  MAX_FRAME_MESSAGES_PER_SECOND,
  RENDER_INIT_MESSAGE_TYPE,
  RENDER_PROTOCOL_VERSION,
  RENDER_TIMEOUT_MS,
  STARTUP_TIMEOUT_MS,
  UNRESPONSIVE_MS,
} from './constants';
import {
  describeInvalidFrameMessage,
  type FrameMessage,
  type HostMessage,
  parseFrameMessage,
  type RenderInput,
  type RenderSize,
} from './protocol';

export type RenderFrameErrorKind =
  | 'startup'
  | 'runtime'
  | 'csp'
  | 'output-limit'
  | 'render-timeout'
  | 'startup-timeout'
  | 'unresponsive'
  | 'navigated-away'
  | 'protocol'
  | 'rate-limit';

export interface RenderFrameError {
  kind: RenderFrameErrorKind;
  message: string;
  seq?: number;
  fatal: boolean;
}

export interface RenderFrameHandlers {
  onReady(): void;
  onRenderComplete(event: { seq: number; durationMs: number; nodeCount: number }): void;
  onHeight(height: number): void;
  onError(error: RenderFrameError): void;
  /** Raw href, already rate-limited; the host validates it with validateRenderLink. */
  onLink(href: string): void;
}

export type RenderFrameState = 'idle' | 'connecting' | 'ready' | 'failed' | 'disposed';

export interface PortLike {
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  start?(): void;
  close(): void;
}

export interface RenderFrameControllerOptions {
  createChannel?: () => { port1: PortLike; port2: Transferable };
  now?: () => number;
}

export interface RenderFrameController {
  /**
   * Bind to <iframe onLoad>. The first load connects; a second load on the same element is fatal.
   * Every fatal error means the host must remove the iframe, which tears its document down, and
   * create a new element with a new controller to try again.
   */
  handleLoad(iframe: HTMLIFrameElement): void;
  /** Returns the seq; before ready only the latest render is kept; -1 once failed or disposed. */
  render(input: RenderInput): number;
  resize(size: RenderSize): number;
  pause(): void;
  resume(): void;
  getState(): RenderFrameState;
  dispose(): void;
}

const RATE_WINDOW_MS = 1000;

function defaultChannel(): { port1: PortLike; port2: Transferable } {
  const channel = new MessageChannel();
  const native = channel.port1;
  let listener: PortLike['onmessage'] = null;
  const port1: PortLike = {
    postMessage: (message) => native.postMessage(message),
    get onmessage() {
      return listener;
    },
    set onmessage(handler) {
      listener = handler;
      native.onmessage = handler ? (event) => handler({ data: event.data }) : null;
    },
    start: () => native.start(),
    close: () => native.close(),
  };
  return { port1, port2: channel.port2 };
}

/** One controller per iframe element. The transferred port is the only channel, never a window listener. */
export function createRenderFrameController(
  handlers: RenderFrameHandlers,
  options: RenderFrameControllerOptions = {}
): RenderFrameController {
  const createChannel = options.createChannel ?? defaultChannel;
  const now = options.now ?? (() => Date.now());

  let state: RenderFrameState = 'idle';
  let frameElement: HTMLIFrameElement | undefined;
  let port: PortLike | undefined;
  let seq = 0;
  let queued: HostMessage | undefined;
  let lastInput: RenderInput | undefined;
  let paused = false;
  // The latest seq sent and not yet completed, errored or timed out.
  let awaitingSeq: number | undefined;

  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  let pingId = 0;
  let pingedAt: number | undefined;
  let tickAt = 0;

  let recentMessages: Array<{ at: number; type: string }> = [];
  let lastLinkAt = -Infinity;

  const isClosed = () => state === 'failed' || state === 'disposed';

  const send = (message: HostMessage) => {
    if (!port || isClosed()) {
      return;
    }
    try {
      port.postMessage(message);
    } catch {
      // A closed port has nothing left to deliver.
    }
  };

  const clearRenderTimer = () => {
    if (renderTimer !== undefined) {
      clearTimeout(renderTimer);
      renderTimer = undefined;
    }
  };

  const armRenderTimer = () => {
    clearRenderTimer();
    if (awaitingSeq === undefined || paused || state !== 'ready') {
      return;
    }
    const timedOutSeq = awaitingSeq;
    renderTimer = setTimeout(() => {
      renderTimer = undefined;
      if (awaitingSeq !== timedOutSeq || isClosed()) {
        return;
      }
      awaitingSeq = undefined;
      handlers.onError({
        kind: 'render-timeout',
        message: `The panel code did not finish drawing within ${RENDER_TIMEOUT_MS / 1000} seconds.`,
        seq: timedOutSeq,
        fatal: false,
      });
    }, RENDER_TIMEOUT_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeatTimer !== undefined) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    if (state !== 'ready' || paused) {
      return;
    }
    pingedAt = undefined;
    tickAt = now();
    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
  };

  function heartbeat() {
    const at = now();
    // A hidden or throttled host can delay the answer too, so the wait starts over.
    if (isDocumentHidden() || at - tickAt > HEARTBEAT_MS * 3) {
      pingedAt = undefined;
    }
    tickAt = at;
    if (pingedAt === undefined) {
      pingedAt = at;
      send({ type: 'ping', id: ++pingId });
    } else if (at - pingedAt > UNRESPONSIVE_MS) {
      // Judged from the first ping: a frame stuck in its first draw never answers at all.
      fail(
        'unresponsive',
        `The panel code stopped responding for more than ${UNRESPONSIVE_MS / 1000} seconds, for example because of a loop that never ends.`
      );
    }
  }

  const teardown = () => {
    if (startupTimer !== undefined) {
      clearTimeout(startupTimer);
      startupTimer = undefined;
    }
    clearRenderTimer();
    stopHeartbeat();
    queued = undefined;
    lastInput = undefined;
    awaitingSeq = undefined;
    recentMessages = [];
    if (port) {
      port.onmessage = null;
      try {
        port.close();
      } catch {
        // Already closed.
      }
      port = undefined;
    }
  };

  function fail(kind: RenderFrameErrorKind, message: string) {
    if (isClosed()) {
      return;
    }
    state = 'failed';
    teardown();
    handlers.onError({ kind, message: message.slice(0, MAX_DIAGNOSTIC_LENGTH), fatal: true });
  }

  const admit = (type: string): boolean => {
    const at = now();
    while (recentMessages.length > 0 && at - recentMessages[0].at >= RATE_WINDOW_MS) {
      recentMessages.shift();
    }
    recentMessages.push({ at, type });
    return recentMessages.length <= MAX_FRAME_MESSAGES_PER_SECOND;
  };

  const rateSummary = (): string => {
    const counts = new Map<string, number>();
    for (const { type } of recentMessages) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
  };

  const onPortMessage = (event: { data: unknown }) => {
    if (isClosed()) {
      return;
    }
    const data = event.data;
    // Every message counts, valid or not, so a frame cannot flood the host with anything.
    if (!admit(messageTypeOf(data))) {
      fail(
        'rate-limit',
        `The panel frame sent more than ${MAX_FRAME_MESSAGES_PER_SECOND} messages in one second (${rateSummary()}).`
      );
      return;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      fail('protocol', 'The panel frame sent a message that is not an object.');
      return;
    }
    const message = parseFrameMessage(data);
    if (!message) {
      fail('protocol', describeInvalidFrameMessage(data));
      return;
    }
    handle(message);
  };

  function handle(message: FrameMessage) {
    // A draw the host never asked for would settle the image renderer's wait early.
    if (
      (message.type === 'render-complete' || message.type === 'error') &&
      message.seq !== undefined &&
      message.seq > seq
    ) {
      fail('protocol', `The panel frame reported a draw that was not sent (seq ${message.seq}).`);
      return;
    }
    switch (message.type) {
      case 'ready':
        if (state !== 'connecting') {
          return;
        }
        state = 'ready';
        if (startupTimer !== undefined) {
          clearTimeout(startupTimer);
          startupTimer = undefined;
        }
        if (paused) {
          send({ type: 'pause' });
        }
        startHeartbeat();
        handlers.onReady();
        if (queued && !isClosed()) {
          const pending = queued;
          queued = undefined;
          send(pending);
          armRenderTimer();
        }
        return;
      case 'render-complete':
        if (message.seq === awaitingSeq) {
          awaitingSeq = undefined;
          clearRenderTimer();
        }
        handlers.onRenderComplete({ seq: message.seq, durationMs: message.durationMs, nodeCount: message.nodeCount });
        return;
      case 'height':
        handlers.onHeight(message.height);
        return;
      case 'error':
        if (message.seq !== undefined && message.seq === awaitingSeq) {
          awaitingSeq = undefined;
          clearRenderTimer();
        }
        handlers.onError({ kind: message.kind, message: message.message, seq: message.seq, fatal: false });
        return;
      case 'link': {
        const at = now();
        if (at - lastLinkAt < LINK_MIN_INTERVAL_MS) {
          return;
        }
        lastLinkAt = at;
        handlers.onLink(message.href);
        return;
      }
      case 'pong':
        if (message.id === pingId && pingedAt !== undefined) {
          pingedAt = undefined;
          return;
        }
        // An earlier ping can be answered after the host restarted the wait. Anything else is a
        // pong the host never asked for.
        if (message.id < 1 || message.id >= pingId) {
          fail('protocol', `The panel frame answered a heartbeat that was not sent (id ${message.id}).`);
        }
        return;
    }
  }

  const dispatch = (message: Extract<HostMessage, { type: 'render' | 'resize' }>) => {
    awaitingSeq = message.seq;
    if (state === 'ready') {
      send(message);
      armRenderTimer();
    } else {
      queued = message;
    }
  };

  // Armed on creation, not on load, so a frame that never loads cannot hold the panel either.
  startupTimer = setTimeout(() => {
    startupTimer = undefined;
    fail('startup-timeout', `The panel frame did not start within ${STARTUP_TIMEOUT_MS / 1000} seconds.`);
  }, STARTUP_TIMEOUT_MS);

  return {
    handleLoad(iframe) {
      if (isClosed()) {
        return;
      }
      if (frameElement !== undefined) {
        fail(
          'navigated-away',
          iframe === frameElement
            ? 'The panel frame loaded a second time, so it navigated away from its document.'
            : 'A different panel frame element loaded for the same controller.'
        );
        return;
      }
      frameElement = iframe;
      state = 'connecting';
      const channel = createChannel();
      port = channel.port1;
      port.onmessage = onPortMessage;
      port.start?.();
      // An opaque frame has a null origin, so '*' is the only target; the message carries no data.
      iframe.contentWindow?.postMessage({ type: RENDER_INIT_MESSAGE_TYPE, version: RENDER_PROTOCOL_VERSION }, '*', [
        channel.port2,
      ]);
    },
    render(input) {
      if (isClosed()) {
        return -1;
      }
      lastInput = input;
      const next = ++seq;
      dispatch({ type: 'render', seq: next, input });
      return next;
    },
    resize(size) {
      if (isClosed() || !lastInput) {
        return -1;
      }
      lastInput = { ...lastInput, width: size.width, height: size.height };
      const next = ++seq;
      if (state === 'ready') {
        dispatch({ type: 'resize', seq: next, size });
      } else {
        // The frame has nothing to resize yet, so the queued render carries the new size.
        dispatch({ type: 'render', seq: next, input: lastInput });
      }
      return next;
    },
    pause() {
      if (isClosed() || paused) {
        return;
      }
      paused = true;
      stopHeartbeat();
      clearRenderTimer();
      if (state === 'ready') {
        send({ type: 'pause' });
      }
    },
    resume() {
      if (isClosed() || !paused) {
        return;
      }
      paused = false;
      if (state === 'ready') {
        send({ type: 'resume' });
        startHeartbeat();
        armRenderTimer();
      }
    },
    getState() {
      return state;
    },
    dispose() {
      if (state === 'disposed') {
        return;
      }
      state = 'disposed';
      teardown();
    },
  };
}

function messageTypeOf(data: unknown): string {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const type: unknown = Reflect.get(data, 'type');
    if (typeof type === 'string') {
      return type.slice(0, 64);
    }
  }
  return Array.isArray(data) ? 'array' : typeof data;
}

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}

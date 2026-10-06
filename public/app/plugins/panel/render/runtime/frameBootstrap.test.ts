import { JSDOM, VirtualConsole } from 'jsdom';

import { MAX_DOM_NODES, RENDER_INIT_MESSAGE_TYPE, RENDER_PROTOCOL_VERSION } from './constants';
import { contentDocument } from './document';
import type { RenderInput } from './protocol';

// jsdom does not enforce CSP, so these tests cover the bootstrap logic only.

interface FakePort {
  sent: unknown[];
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

function createPort(): FakePort {
  const port: FakePort = {
    sent: [],
    postMessage: (message) => port.sent.push(message),
    onmessage: null,
  };
  return port;
}

function mountFrame(code: string) {
  const dom = new JSDOM(contentDocument(code, 'testNonce', false), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    // Uncaught errors in user code are expected here; keep jsdom from printing them.
    virtualConsole: new VirtualConsole(),
  });
  const window = dom.window;
  const dispatchInit = (port: FakePort, overrides: Record<string, unknown> = {}) => {
    const event = Object.assign(new window.Event('message'), {
      data: { type: RENDER_INIT_MESSAGE_TYPE, version: RENDER_PROTOCOL_VERSION },
      source: window.parent,
      ports: [port],
      ...overrides,
    });
    window.dispatchEvent(event);
  };
  return { dom, window, dispatchInit };
}

function connect(code: string) {
  const frame = mountFrame(code);
  const port = createPort();
  frame.dispatchInit(port);
  const send = (data: unknown) => port.onmessage?.({ data });
  return { ...frame, port, send };
}

async function until(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('condition not met in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function messagesOfType(port: FakePort, type: string): Array<Record<string, unknown>> {
  return port.sent.filter(
    (message): message is Record<string, unknown> =>
      typeof message === 'object' && message !== null && Reflect.get(message, 'type') === type
  );
}

function makeInput(overrides: Partial<RenderInput> = {}): RenderInput {
  return {
    data: {
      state: 'Done',
      errors: [],
      series: [
        { refId: 'A', length: 1, source: { panelId: 2, title: 'CPU' }, fields: [] },
        { refId: 'A', length: 1, fields: [] },
        { refId: 'B', length: 1, source: { panelId: 2, title: 'CPU' }, fields: [] },
      ],
    },
    timeRange: { from: 0, to: 1000, raw: { from: 'now-1h', to: 'now' } },
    timeZone: 'UTC',
    variables: { env: { value: 'prod', text: 'prod' } },
    theme: {
      mode: 'dark',
      colors: {
        text: { primary: 'rgb(1, 2, 3)', secondary: 's', disabled: 'd', link: 'l' },
        background: { canvas: 'c', primary: 'p', secondary: 's' },
        border: { weak: 'w', medium: 'm', strong: 's' },
        primary: { main: 'pm', text: 'pt', contrastText: 'pc' },
        success: { main: 'sm', text: 'st' },
        warning: { main: 'wm', text: 'wt' },
        error: { main: 'em', text: 'et' },
        info: { main: 'im', text: 'it' },
      },
      palette: ['red', 'blue'],
      typography: { fontFamily: 'Inter', fontFamilyMonospace: 'Mono', fontSize: 14, bodySmallFontSize: '12px' },
      spacingGridSize: 8,
      borderRadius: '6px',
    },
    size: { width: 400, height: 300 },
    isRenderTarget: false,
    ...overrides,
  };
}

const RECORDING_CODE = `
  window.draws = [];
  panel.onRender(function (ctx) {
    window.draws.push({ seq: ctx.seq, width: ctx.size.width, groups: ctx.helpers.bySource().map(function (g) { return [g.panelId, g.frames.length]; }) });
    ctx.root.textContent = 'drawn ' + ctx.seq;
  });
`;

describe('content frame bootstrap', () => {
  it('reports ready after a valid init', () => {
    const { port } = connect('panel.onRender(function () {});');
    expect(port.sent).toEqual([{ type: 'ready', version: 1 }]);
  });

  it('buffers a startup error until init, then sends it before ready', () => {
    const { dispatchInit } = mountFrame('throw new Error("boom");');
    const port = createPort();
    dispatchInit(port);
    expect(port.sent).toEqual([
      { type: 'error', kind: 'startup', message: 'Error: boom' },
      { type: 'ready', version: 1 },
    ]);
  });

  it('reports a startup error when the code never calls panel.onRender', () => {
    const { port } = connect('var nothing = 1;');
    expect(port.sent[0]).toEqual({
      type: 'error',
      kind: 'startup',
      message: 'The code did not call panel.onRender(draw) at the top level.',
    });
  });

  it('ignores init with the wrong source, version or ports, and any second init', () => {
    const { dispatchInit } = mountFrame('panel.onRender(function () {});');
    const port = createPort();
    dispatchInit(port, { source: null });
    dispatchInit(port, { data: { type: RENDER_INIT_MESSAGE_TYPE, version: 2 } });
    dispatchInit(port, { data: { type: 'other', version: 1 } });
    dispatchInit(port, { ports: [] });
    dispatchInit(port, { ports: [createPort(), createPort()] });
    expect(port.sent).toEqual([]);

    dispatchInit(port);
    const intruder = createPort();
    dispatchInit(intruder);
    expect(port.sent).toEqual([{ type: 'ready', version: 1 }]);
    expect(intruder.sent).toEqual([]);
    expect(intruder.onmessage).toBeNull();
  });

  it('coalesces renders and draws only the latest seq', async () => {
    const { port, send, window } = connect(RECORDING_CODE);
    send({ type: 'render', seq: 1, input: makeInput({ size: { width: 100, height: 1 } }) });
    send({ type: 'render', seq: 2, input: makeInput({ size: { width: 200, height: 1 } }) });
    send({ type: 'render', seq: 3, input: makeInput({ size: { width: 300, height: 1 } }) });
    await until(() => messagesOfType(port, 'render-complete').length > 0);

    expect(Reflect.get(window, 'draws')).toEqual([
      {
        seq: 3,
        width: 300,
        groups: [
          [2, 2],
          [null, 1],
        ],
      },
    ]);
    expect(messagesOfType(port, 'render-complete')).toEqual([
      { type: 'render-complete', seq: 3, durationMs: expect.any(Number), nodeCount: 0 },
    ]);
    expect(window.document.getElementById('root')?.textContent).toBe('drawn 3');
    expect(window.document.documentElement.style.getPropertyValue('--gf-color-text-primary')).toBe('rgb(1, 2, 3)');
    expect(window.document.documentElement.style.getPropertyValue('--gf-palette-1')).toBe('blue');
  });

  it('redraws the last input with the new size on resize', async () => {
    const { port, send, window } = connect(RECORDING_CODE);
    send({ type: 'render', seq: 1, input: makeInput() });
    await until(() => messagesOfType(port, 'render-complete').length === 1);
    send({ type: 'resize', seq: 2, size: { width: 640, height: 480 } });
    await until(() => messagesOfType(port, 'render-complete').length === 2);

    const draws: Array<{ seq: number; width: number }> = Reflect.get(window, 'draws');
    expect(draws.map(({ seq, width }) => [seq, width])).toEqual([
      [1, 400],
      [2, 640],
    ]);
  });

  it('reports a throwing draw as a runtime error for that seq', async () => {
    const { port, send } = connect('panel.onRender(function () { throw new TypeError("bad draw"); });');
    send({ type: 'render', seq: 7, input: makeInput() });
    await until(() => messagesOfType(port, 'error').length > 0);
    expect(messagesOfType(port, 'error')).toEqual([
      { type: 'error', kind: 'runtime', message: 'TypeError: bad draw', seq: 7 },
    ]);
    expect(messagesOfType(port, 'render-complete')).toEqual([]);
  });

  it('reports a rejected async draw as a runtime error', async () => {
    const { port, send } = connect('panel.onRender(function () { return Promise.reject(new Error("later")); });');
    send({ type: 'render', seq: 1, input: makeInput() });
    await until(() => messagesOfType(port, 'error').length > 0);
    expect(messagesOfType(port, 'error')).toEqual([
      { type: 'error', kind: 'runtime', message: 'Error: later', seq: 1 },
    ]);
  });

  it('clears #root and reports output-limit when the drawing has too many elements', async () => {
    const code = `panel.onRender(function (ctx) { ctx.root.innerHTML = new Array(${MAX_DOM_NODES + 2}).join('<i></i>'); });`;
    const { port, send, window } = connect(code);
    send({ type: 'render', seq: 1, input: makeInput() });
    await until(() => messagesOfType(port, 'error').length > 0);

    expect(messagesOfType(port, 'error')).toEqual([
      {
        type: 'error',
        kind: 'output-limit',
        message: `The drawing created ${MAX_DOM_NODES + 1} elements, more than the limit of ${MAX_DOM_NODES}. The panel was cleared.`,
        seq: 1,
      },
    ]);
    expect(window.document.getElementById('root')?.childNodes.length).toBe(0);
  });

  it('sends link clicks to the host and prevents the navigation', async () => {
    const code = `panel.onRender(function (ctx) { ctx.root.innerHTML = '<a id="go" href="/d/abc"><span id="label">Go</span></a><a id="local" href="#section">Local</a><div id="section"></div>'; });`;
    const { port, send, window } = connect(code);
    send({ type: 'render', seq: 1, input: makeInput() });
    await until(() => messagesOfType(port, 'render-complete').length > 0);

    const click = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    const notPrevented = window.document.getElementById('label')!.dispatchEvent(click);
    expect(notPrevented).toBe(false);
    expect(messagesOfType(port, 'link')).toEqual([{ type: 'link', href: '/d/abc' }]);

    // A fragment that exists in the frame scrolls locally and is never sent.
    window.document
      .getElementById('local')!
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(messagesOfType(port, 'link')).toHaveLength(1);
  });

  it('answers ping with pong', () => {
    const { port, send } = connect('panel.onRender(function () {});');
    send({ type: 'ping', id: 42 });
    expect(messagesOfType(port, 'pong')).toEqual([{ type: 'pong', id: 42 }]);
  });

  it('holds the latest draw while paused and draws it on resume', async () => {
    const { port, send, window } = connect(RECORDING_CODE);
    send({ type: 'pause' });
    send({ type: 'render', seq: 1, input: makeInput() });
    send({ type: 'render', seq: 2, input: makeInput() });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(Reflect.get(window, 'draws')).toEqual([]);

    send({ type: 'resume' });
    await until(() => messagesOfType(port, 'render-complete').length > 0);
    const draws: Array<{ seq: number }> = Reflect.get(window, 'draws');
    expect(draws.map(({ seq }) => seq)).toEqual([2]);
  });
});

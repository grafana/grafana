import { type DOMWindow, JSDOM, VirtualConsole } from 'jsdom';

import { MAX_DOM_NODES, MAX_LAYOUT_ELEMENTS, RENDER_INIT_MESSAGE_TYPE, RENDER_PROTOCOL_VERSION } from './constants';
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

function mountFrame(code: string, beforeParse?: (window: DOMWindow) => void) {
  const dom = new JSDOM(contentDocument(code, 'testNonce', false), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse,
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

function connect(code: string, beforeParse?: (window: DOMWindow) => void) {
  const frame = mountFrame(code, beforeParse);
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
  const timeRange = { from: 0, to: 1000, raw: { from: 'now-1h', to: 'now' } };
  return {
    id: 1,
    title: 'Custom',
    data: {
      state: 'Done',
      errors: [],
      timeRange,
      series: [{ refId: 'A', length: 1, fields: [] }],
    },
    timeRange,
    timeZone: 'UTC',
    options: {},
    fieldConfig: { defaults: {}, overrides: [] },
    width: 400,
    height: 300,
    transparent: false,
    fitContent: false,
    location: { pathname: '/d/abc', search: '?var-env=prod' },
    theme: {
      colorScheme: 'dark',
      vars: { '--gf-color-text-primary': 'rgb(1, 2, 3)', '--gf-palette-1': 'blue', color: 'red' },
    },
    ...overrides,
  };
}

// Each draw records the title it got, which the tests use to tell renders apart.
const RECORDING_CODE = `
  window.draws = [];
  panel.onRender(function (ctx) {
    window.draws.push({ title: ctx.title, width: ctx.width });
    ctx.root.textContent = 'drawn ' + ctx.title;
  });
`;

/**
 * jsdom has no layout, so boxes come from attributes: data-rect="x,y,width,height" for an element
 * and data-text-rect for its text (else the element's box). The frame is 400x300.
 */
function stubLayout(window: DOMWindow) {
  const rectOf = (element: Element, attribute = 'data-rect') => {
    const [x, y, width, height] = (element.getAttribute(attribute) ?? element.getAttribute('data-rect') ?? '0,0,0,0')
      .split(',')
      .map(Number);
    return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
  };
  const define = (target: object, name: string, descriptor: PropertyDescriptor) =>
    Object.defineProperty(target, name, { configurable: true, ...descriptor });
  const isFrame = (element: Element) => element === element.ownerDocument.documentElement;
  define(window.Element.prototype, 'getBoundingClientRect', {
    value(this: Element) {
      return rectOf(this);
    },
  });
  define(window.Element.prototype, 'clientWidth', {
    get(this: Element) {
      return isFrame(this) ? 400 : rectOf(this).width;
    },
  });
  define(window.Element.prototype, 'clientHeight', {
    get(this: Element) {
      return isFrame(this) ? 300 : rectOf(this).height;
    },
  });
  define(window.Range.prototype, 'getClientRects', {
    value(this: Range) {
      const parent = this.startContainer.parentElement;
      return parent ? [rectOf(parent, 'data-text-rect')] : [];
    },
  });
}

const LAYOUT_CODE = `panel.onRender(function (ctx) {
  ctx.root.setAttribute('data-rect', '0,0,400,300');
  ctx.root.innerHTML =
    '<div class="chart" data-rect="0,0,100,50" style="background-color:red"></div>' +
    '<div class="wide" data-rect="0,60,500,20" style="background-color:red"><span data-rect="0,60,500,20">wide</span></div>' +
    '<div class="card" data-rect="0,100,100,20" data-text-rect="0,100,100,40" style="overflow-x:hidden;overflow-y:hidden">Long label</div>' +
    '<div style="position:relative" data-rect="0,150,400,80">' +
    '<span class="a" style="position:absolute" data-rect="200,200,80,20">Requests</span>' +
    '<span class="b" style="position:absolute" data-rect="210,205,80,20">Errors</span></div>' +
    '<div class="x" data-rect="0,250,100,30" style="background-color:blue"></div>' +
    '<div class="y" data-rect="0,260,100,30" style="background-color:blue"></div>';
});`;

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
    send({ type: 'render', seq: 1, input: makeInput({ title: '1', width: 100 }) });
    send({ type: 'render', seq: 2, input: makeInput({ title: '2', width: 200 }) });
    send({ type: 'render', seq: 3, input: makeInput({ title: '3', width: 300 }) });
    await until(() => messagesOfType(port, 'render-complete').length > 0);

    expect(Reflect.get(window, 'draws')).toEqual([{ title: '3', width: 300 }]);
    expect(messagesOfType(port, 'render-complete')).toEqual([
      { type: 'render-complete', seq: 3, durationMs: expect.any(Number), nodeCount: 0 },
    ]);
    expect(window.document.getElementById('root')?.textContent).toBe('drawn 3');
    expect(window.document.documentElement.style.getPropertyValue('--gf-color-text-primary')).toBe('rgb(1, 2, 3)');
    expect(window.document.documentElement.style.getPropertyValue('--gf-palette-1')).toBe('blue');
    expect(window.document.documentElement.style.getPropertyValue('color')).toBe('');
    expect(window.document.documentElement.style.colorScheme).toBe('dark');
  });

  it('hands the draw the PanelProps-shaped context and nothing else', async () => {
    const { port, send, window } = connect(`
      panel.onRender(function (ctx) {
        window.ctx = ctx;
        window.api = { apiVersion: panel.apiVersion, keys: Object.keys(panel) };
      });
    `);
    const input = makeInput();
    send({ type: 'render', seq: 1, input });
    await until(() => messagesOfType(port, 'render-complete').length > 0);

    const { theme, ...expected } = input;
    expect(Reflect.get(window, 'ctx')).toEqual({ ...expected, root: window.document.getElementById('root') });
    expect(Reflect.get(window, 'api')).toEqual({ apiVersion: 1, keys: ['apiVersion', 'onRender'] });
  });

  it('removes the CSS variables of a previous theme', async () => {
    const { port, send, window } = connect('panel.onRender(function () {});');
    send({ type: 'render', seq: 1, input: makeInput() });
    await until(() => messagesOfType(port, 'render-complete').length === 1);
    send({
      type: 'render',
      seq: 2,
      input: makeInput({ theme: { colorScheme: 'light', vars: { '--gf-color-text-primary': 'black' } } }),
    });
    await until(() => messagesOfType(port, 'render-complete').length === 2);

    const style = window.document.documentElement.style;
    expect(style.getPropertyValue('--gf-color-text-primary')).toBe('black');
    expect(style.getPropertyValue('--gf-palette-1')).toBe('');
    expect(style.colorScheme).toBe('light');
  });

  it('redraws the last input with the new size on resize', async () => {
    const { port, send, window } = connect(RECORDING_CODE);
    send({ type: 'render', seq: 1, input: makeInput() });
    await until(() => messagesOfType(port, 'render-complete').length === 1);
    send({ type: 'resize', seq: 2, size: { width: 640, height: 480 } });
    await until(() => messagesOfType(port, 'render-complete').length === 2);

    const draws: Array<{ width: number; height: number }> = Reflect.get(window, 'draws');
    expect(draws.map(({ width }) => width)).toEqual([400, 640]);
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

  describe('layout report', () => {
    it('reports coverage, empty regions, overflow, clipped text and overlaps with the draw', async () => {
      const { port, send } = connect(LAYOUT_CODE, stubLayout);
      send({ type: 'render', seq: 1, input: makeInput() });
      await until(() => messagesOfType(port, 'render-complete').length > 0);

      const [complete] = messagesOfType(port, 'render-complete');
      expect(complete.layout).toEqual({
        width: 400,
        height: 300,
        coverage: expect.any(Number),
        // The grid is 25x19 cells of 16x15.8 px; the right side between the drawn rows is empty.
        emptyRegions: [
          { x: 112, y: 95, width: 288, height: 95, share: 0.23 },
          { x: 112, y: 237, width: 288, height: 63, share: 0.15 },
          { x: 112, y: 0, width: 288, height: 47, share: 0.11 },
        ],
        overflowing: {
          count: 1,
          samples: [{ element: 'div.wide', x: 0, y: 60, width: 500, height: 20, sides: ['right'] }],
        },
        clippedText: {
          count: 1,
          samples: [{ element: 'div.card', text: 'Long label', visible: 0.5, ellipsis: false }],
        },
        overlaps: {
          count: 2,
          samples: [
            { kind: 'text', a: 'div > span.a', b: 'div > span.b', area: 1050, aText: 'Requests', bText: 'Errors' },
            { kind: 'box', a: 'div.x', b: 'div.y', area: 2000 },
          ],
        },
        inspected: 10,
        truncated: false,
        durationMs: expect.any(Number),
      });
      // 21,550 px² of 120,000 drawn; boxes stacked inside one cell count once per box, up to the cell.
      expect(complete.layout).toHaveProperty('coverage', 0.19);
    });

    it('looks at a bounded number of elements and says when it stopped early', async () => {
      const code = `panel.onRender(function (ctx) {
        ctx.root.setAttribute('data-rect', '0,0,400,300');
        ctx.root.innerHTML = new Array(${MAX_LAYOUT_ELEMENTS + 100}).join('<i data-rect="0,0,4,4"></i>');
      });`;
      const { port, send } = connect(code, stubLayout);
      send({ type: 'render', seq: 1, input: makeInput() });
      await until(() => messagesOfType(port, 'render-complete').length > 0);

      const [complete] = messagesOfType(port, 'render-complete');
      expect(complete.layout).toEqual(expect.objectContaining({ inspected: MAX_LAYOUT_ELEMENTS, truncated: true }));
    });

    it('leaves the report out when the frame has no size', async () => {
      const { port, send } = connect(LAYOUT_CODE);
      send({ type: 'render', seq: 1, input: makeInput() });
      await until(() => messagesOfType(port, 'render-complete').length > 0);

      expect(messagesOfType(port, 'render-complete')[0]).not.toHaveProperty('layout');
    });
  });

  it('answers ping with pong', () => {
    const { port, send } = connect('panel.onRender(function () {});');
    send({ type: 'ping', id: 42 });
    expect(messagesOfType(port, 'pong')).toEqual([{ type: 'pong', id: 42 }]);
  });

  it('holds the latest draw while paused and draws it on resume', async () => {
    const { port, send, window } = connect(RECORDING_CODE);
    send({ type: 'pause' });
    send({ type: 'render', seq: 1, input: makeInput({ title: '1' }) });
    send({ type: 'render', seq: 2, input: makeInput({ title: '2' }) });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(Reflect.get(window, 'draws')).toEqual([]);

    send({ type: 'resume' });
    await until(() => messagesOfType(port, 'render-complete').length > 0);
    const draws: Array<{ title: string }> = Reflect.get(window, 'draws');
    expect(draws.map(({ title }) => title)).toEqual(['2']);
  });

  describe('realm hardening', () => {
    const WEBRTC_CONSTRUCTORS = [
      'RTCPeerConnection',
      'webkitRTCPeerConnection',
      'RTCDataChannel',
      'RTCRtpSender',
      'RTCRtpReceiver',
      'RTCIceTransport',
      'RTCSctpTransport',
    ];

    // jsdom has no WebRTC, so native-looking constructors are installed before the bootstrap runs.
    const withWebRtc = (window: DOMWindow) => {
      for (const name of WEBRTC_CONSTRUCTORS) {
        Object.defineProperty(window, name, {
          value: function NativeConstructor() {},
          writable: true,
          configurable: true,
        });
      }
    };

    // The user code records what it could do; each probe catches its own error.
    const PROBE_CODE = `
      window.results = {};
      function probe(name, fn) {
        try { window.results[name] = fn(); } catch (e) { window.results[name] = 'threw: ' + e.message; }
      }
      var names = ${JSON.stringify(WEBRTC_CONSTRUCTORS)};
      names.forEach(function (name) {
        probe('new ' + name, function () { new window[name](); return 'constructed'; });
        probe('call ' + name, function () { window[name](); return 'called'; });
        probe('assign ' + name, function () { window[name] = function () {}; return 'assigned'; });
        probe('redefine ' + name, function () { Object.defineProperty(window, name, { value: 1 }); return 'redefined'; });
      });
      probe('createElement iframe', function () { return String(document.createElement('iframe')); });
      probe('createElement IFRAME', function () { return String(document.createElement('IFRAME')); });
      probe('createElementNS iframe', function () {
        return String(document.createElementNS('http://www.w3.org/1999/xhtml', 'iframe'));
      });
      ['frame', 'object', 'embed'].forEach(function (tag) {
        probe('createElement ' + tag, function () { return String(document.createElement(tag)); });
      });
      probe('innerHTML iframe', function () { document.body.innerHTML += '<div><IFRAME src="about:blank"></IFRAME></div>'; return 'set'; });
      probe('innerHTML svg iframe', function () { document.getElementById('root').innerHTML = '<svg><foreignObject><iframe/></foreignObject></svg>'; return 'set'; });
      probe('insertAdjacentHTML embed', function () { document.body.insertAdjacentHTML('beforeend', '<embed src="data:,x">'); return 'set'; });
      probe('outerHTML object', function () { document.getElementById('root').outerHTML = '<object data="x"></object>'; return 'set'; });
      probe('toString swap', function () {
        var calls = 0;
        document.getElementById('root').innerHTML = { toString: function () { return calls++ === 0 ? '<b></b>' : '<iframe></iframe>'; } };
        return 'set ' + calls;
      });
      var parsed = new DOMParser().parseFromString('<iframe></iframe><p><object></object></p>', 'text/html');
      var parsedFrame = parsed.body.firstChild;
      Object.defineProperty(parsedFrame, 'localName', { value: 'div' });
      probe('appendChild parsed iframe', function () { document.body.appendChild(parsedFrame); return 'inserted'; });
      probe('append nested object', function () { document.body.append(parsed.body.lastChild); return 'inserted'; });
      probe('insertBefore parsed iframe', function () { document.body.insertBefore(parsedFrame, null); return 'inserted'; });
      probe('replaceChild parsed iframe', function () { document.body.replaceChild(parsedFrame, document.getElementById('root')); return 'inserted'; });
      probe('fragment with iframe', function () {
        var fragment = document.createRange().createContextualFragment('<i></i>');
        fragment.appendChild(parsedFrame);
        return 'inserted';
      });
      probe('replace appendChild', function () { Node.prototype.appendChild = function () { return 'mine'; }; return document.body.appendChild(document.createTextNode('x')) === 'mine' ? 'replaced' : 'kept'; });
      probe('frames', function () { return window.frames.length + window.length; });
      probe('frame elements', function () { return document.querySelectorAll('iframe,frame,object,embed').length; });
      panel.onRender(function () {});
    `;

    const results = (window: DOMWindow): Record<string, unknown> => Reflect.get(window, 'results');

    it('replaces WebRTC constructors with locked stubs that throw', () => {
      const { window } = mountFrame(PROBE_CODE, withWebRtc);
      const recorded = results(window);
      for (const name of WEBRTC_CONSTRUCTORS) {
        expect(recorded['new ' + name]).toBe(`threw: ${name} is not available in the custom panel.`);
        expect(recorded['call ' + name]).toBe(`threw: ${name} is not available in the custom panel.`);
        // A strict-mode assignment to a read-only property throws; sloppy code would silently fail.
        expect(recorded['assign ' + name]).toEqual(expect.stringMatching(/^(threw|assigned)/));
        expect(recorded['redefine ' + name]).toEqual(expect.stringContaining('threw'));
        const descriptor = Object.getOwnPropertyDescriptor(window, name);
        expect(descriptor).toMatchObject({ writable: false, configurable: false });
        expect(() => new (Reflect.get(window, name))()).toThrow(`${name} is not available in the custom panel.`);
      }
    });

    it('does not define WebRTC globals the browser does not have', () => {
      const { window } = mountFrame('panel.onRender(function () {});');
      expect('RTCPeerConnection' in window).toBe(false);
    });

    it('stops the code from creating, parsing or inserting nested frames', () => {
      const { window } = mountFrame(PROBE_CODE, withWebRtc);
      const recorded = results(window);
      const blocked = 'threw: Nested frames, objects and embeds are not available in the custom panel.';
      for (const probe of [
        'createElement iframe',
        'createElement IFRAME',
        'createElementNS iframe',
        'createElement frame',
        'createElement object',
        'createElement embed',
        'innerHTML iframe',
        'innerHTML svg iframe',
        'insertAdjacentHTML embed',
        'outerHTML object',
        'appendChild parsed iframe',
        'append nested object',
        'insertBefore parsed iframe',
        'replaceChild parsed iframe',
        'fragment with iframe',
      ]) {
        expect([probe, recorded[probe]]).toEqual([probe, blocked]);
      }
      // The value is read once, so the markup checked is the markup set.
      expect(recorded['toString swap']).toBe('set 1');
      // The guarded prototype methods cannot be swapped out.
      expect(recorded['replace appendChild']).toEqual(expect.stringMatching(/^(threw|kept)/));
      expect(recorded.frames).toBe(0);
      expect(recorded['frame elements']).toBe(0);
      expect(window.document.querySelectorAll('iframe,frame,object,embed')).toHaveLength(0);
    });

    it('never exposes the window of a frame element', () => {
      const { window } = mountFrame('panel.onRender(function () {});');
      const parsed = new window.DOMParser().parseFromString('<iframe></iframe>', 'text/html');
      const frame = parsed.body.firstChild;
      expect(Reflect.get(Object(frame), 'contentWindow')).toBeNull();
      expect(Reflect.get(Object(frame), 'contentDocument')).toBeNull();
    });

    it('still lets the drawing use ordinary markup and elements', async () => {
      const code = `panel.onRender(function (ctx) {
        ctx.root.innerHTML = '<frame-chart></frame-chart><p class="objective">embedded</p>';
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ctx.root.appendChild(svg);
        ctx.root.insertAdjacentHTML('beforeend', '<span>&lt;iframe&gt;</span>');
      });`;
      const { port, send, window } = connect(code);
      send({ type: 'render', seq: 1, input: makeInput() });
      await until(() => messagesOfType(port, 'render-complete').length > 0);
      expect(messagesOfType(port, 'error')).toEqual([]);
      expect(window.document.getElementById('root')?.children).toHaveLength(4);
    });
  });

  describe('nonce concealment', () => {
    // Built at runtime so the probe's own text never contains the nonce.
    const NONCE_PROBE_CODE = `
      var nonce = ['test', 'Nonce'].join('');
      function leaks(value) { return typeof value === 'string' && value.indexOf(nonce) >= 0; }
      var scripts = Array.prototype.slice.call(document.querySelectorAll('script'));
      window.seen = {
        bootstrapGone: scripts.every(function (s) { return s.textContent.indexOf(['hardenRealm', '()'].join('')) < 0; }),
        textLeaks: scripts.some(function (s) { return leaks(s.textContent); }),
        meta: document.querySelectorAll('meta[http-equiv]').length,
      };
      panel.onRender(function () {});
    `;

    const leaksNonce = (value: unknown) => typeof value === 'string' && value.includes('testNonce');

    it('leaves no nonce in any script, attribute or markup after the bootstrap', () => {
      const { window } = mountFrame(NONCE_PROBE_CODE);
      const doc: Document = window.document;
      const scripts = doc.querySelectorAll('script');
      // Both the bootstrap script and the user script are gone once the bootstrap has run.
      expect(scripts).toHaveLength(0);
      scripts.forEach((script) => {
        expect(leaksNonce(script.textContent)).toBe(false);
        expect(leaksNonce(script.nonce)).toBe(false);
        expect(leaksNonce(script.getAttribute('nonce'))).toBe(false);
      });
      expect(leaksNonce(window.document.documentElement.outerHTML)).toBe(false);
      expect(window.document.querySelector('meta[http-equiv]')).toBeNull();
    });

    // jsdom runs no script inside a shadow root, so the bootstrap falls back to a light-DOM script
    // here. Hiding the user script's own nonce while it runs is verified in a real browser.
    it('removes the bootstrap script and the policy element before the user code runs', () => {
      const { window } = mountFrame(NONCE_PROBE_CODE);
      expect(Reflect.get(window, 'seen')).toEqual({ bootstrapGone: true, textLeaks: false, meta: 0 });
    });

    it('keeps policy violation events, which carry the policy text, from the user code', () => {
      const code = `
        window.violations = 0;
        document.addEventListener('securitypolicyviolation', function () { window.violations++; }, true);
        window.addEventListener('securitypolicyviolation', function () { window.violations++; }, true);
        panel.onRender(function () {});
      `;
      const { window, port } = connect(code);
      const event = Object.assign(new window.Event('securitypolicyviolation', { bubbles: true }), {
        violatedDirective: 'img-src',
        blockedURI: 'https://example.com/x.png',
        originalPolicy: "script-src 'nonce-testNonce'",
      });
      window.document.getElementById('root')!.dispatchEvent(event);
      expect(Reflect.get(window, 'violations')).toBe(0);
      expect(messagesOfType(port, 'error')).toEqual([
        { type: 'error', kind: 'csp', message: 'img-src https://example.com/x.png' },
      ]);
    });

    it('replaces ReportingObserver, which also reports the policy text', () => {
      const code = `
        try { new ReportingObserver(function () {}); window.observer = 'created'; } catch (e) { window.observer = e.message; }
        panel.onRender(function () {});
      `;
      const { window } = mountFrame(code, (frameWindow) => {
        Object.defineProperty(frameWindow, 'ReportingObserver', {
          value: function ReportingObserver() {},
          writable: true,
          configurable: true,
        });
      });
      expect(Reflect.get(window, 'observer')).toBe('ReportingObserver is not available in the custom panel.');
    });
  });
  describe('capture', () => {
    // jsdom neither rasterizes SVG images nor implements canvas, so both are stubbed: the stub image
    // records the SVG it was given and the stub canvas returns a fixed PNG data URL.
    function mountCapturable(code: string, loads: boolean) {
      const frame = mountFrame(code, (frameWindow) => {
        class StubImage {
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          set src(value: string) {
            Reflect.set(frameWindow, 'capturedSvg', decodeURIComponent(value.slice(value.indexOf(',') + 1)));
            setTimeout(() => (loads ? this.onload?.() : this.onerror?.()), 0);
          }
        }
        Object.defineProperty(frameWindow, 'Image', { value: StubImage, writable: true, configurable: true });
        const canvasProto = frameWindow.HTMLCanvasElement.prototype;
        canvasProto.getContext = function () {
          return { drawImage: () => {} };
        } as unknown as typeof canvasProto.getContext;
        canvasProto.toDataURL = () => 'data:image/png;base64,AAAA';
      });
      const port = createPort();
      frame.dispatchInit(port);
      const send = (data: unknown) => port.onmessage?.({ data });
      return { ...frame, port, send };
    }

    it('returns a PNG of the drawing, rasterized from a copy of the document without scripts', async () => {
      const code = `panel.onRender(function (ctx) { ctx.root.innerHTML = '<b id="value">42</b><canvas id="chart"></canvas>'; });`;
      const { port, send, window } = mountCapturable(code, true);
      send({ type: 'render', seq: 1, input: makeInput() });
      await until(() => messagesOfType(port, 'render-complete').length > 0);

      send({ type: 'capture', id: 1 });
      await until(() => messagesOfType(port, 'capture').length > 0);

      expect(messagesOfType(port, 'capture')).toEqual([
        { type: 'capture', id: 1, image: 'data:image/png;base64,AAAA' },
      ]);
      const svg = String(Reflect.get(window, 'capturedSvg'));
      expect(svg).toContain('<foreignObject');
      expect(svg).toContain('<b id="value">42</b>');
      expect(svg).not.toContain('<script');
      expect(svg).not.toContain('<canvas');
      expect(svg).toContain('src="data:image/png;base64,AAAA"');
      // The live drawing is untouched.
      expect(window.document.getElementById('chart')?.tagName).toBe('CANVAS');
    });

    it('rewrites :root rules, because the svg is the root element inside the image', async () => {
      const { port, send, window } = mountCapturable('panel.onRender(function () {});', true);
      send({ type: 'capture', id: 1 });
      await until(() => messagesOfType(port, 'capture').length > 0);
      const svg = String(Reflect.get(window, 'capturedSvg'));
      expect(svg).not.toContain(':root');
      expect(svg).toContain('html{color-scheme');
    });

    it('reports an error when the browser cannot rasterize the drawing', async () => {
      const { port, send } = mountCapturable('panel.onRender(function () {});', false);
      send({ type: 'capture', id: 7 });
      await until(() => messagesOfType(port, 'capture').length > 0);
      expect(messagesOfType(port, 'capture')).toEqual([
        { type: 'capture', id: 7, error: 'The browser could not rasterize the drawing.' },
      ]);
    });
  });
});

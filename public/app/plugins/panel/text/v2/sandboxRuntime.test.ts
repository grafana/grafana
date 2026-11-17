import { MAX_BLOCKED_URL_CHARS } from './sandboxPolicy';
import { CSP_CHECK_URL, TEXT_FRAME_PROTOCOL } from './sandboxProtocol';

const parentOrigin = 'https://grafana.test';
const policy = "default-src 'none'";
const command = {
  protocol: TEXT_FRAME_PROTOCOL,
  channel: 'test-channel',
  type: 'render',
  revision: 0,
  html: '<p>Visible content</p>',
  globalCss: 'p{color:red}',
  diagramError: 'Diagram failed',
};

describe('sandbox runtime', () => {
  let postMessage: jest.SpyInstance;
  let measure: ResizeObserverCallback;
  const disconnect = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    postMessage = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
    jest.spyOn(window, 'ResizeObserver').mockImplementation((callback) => {
      measure = callback;
      return { observe: jest.fn(), unobserve: jest.fn(), disconnect };
    });
  });

  afterEach(() => {
    window.dispatchEvent(new Event('pagehide'));
    document.body.replaceChildren();
    document.head.querySelectorAll('style').forEach((style) => style.remove());
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  function initialize(customPolicy?: string) {
    const script = document.createElement('script');
    script.dataset.channel = command.channel;
    script.dataset.parentOrigin = parentOrigin;
    script.nonce = 'test-nonce';
    if (customPolicy !== undefined) {
      script.dataset.policy = customPolicy;
    }
    document.body.append(script);
    jest.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
    jest.isolateModules(() => require('./sandboxRuntime'));
    expect(script.isConnected).toBe(false);
  }

  function message(data: unknown = command, origin = parentOrigin, source: MessageEventSource | null = window) {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
  }

  function violation(blockedURI: string, overrides = {}) {
    document.dispatchEvent(
      Object.assign(new Event('securitypolicyviolation'), {
        blockedURI,
        disposition: 'enforce',
        effectiveDirective: 'img-src',
        originalPolicy: policy,
        ...overrides,
      })
    );
  }

  async function flush() {
    await jest.runAllTimersAsync();
  }

  function expectNotification(type: string, fields = {}) {
    expect(postMessage).toHaveBeenCalledWith(
      {
        type,
        protocol: TEXT_FRAME_PROTOCOL,
        channel: command.channel,
        ...(type !== 'ready' && { revision: 0 }),
        ...fields,
      },
      parentOrigin
    );
  }

  test('requires a bootstrap script', () => {
    jest.spyOn(document, 'currentScript', 'get').mockReturnValue(null);
    expect(() => jest.isolateModules(() => require('./sandboxRuntime'))).toThrow('bootstrap script');
  });

  test('legacy content renders without policy verification and keeps measuring', async () => {
    initialize();
    expectNotification('ready', { document: expect.any(String) });
    violation('https://external.test/image');
    message();
    await flush();
    expect(document.querySelector('p')).toHaveTextContent('Visible content');
    expectNotification('rendered');
    expectNotification('resize', { height: 1, contentHeight: 0 });
    const content = document.querySelector<HTMLElement>('.markdown-html')!;
    jest.spyOn(content, 'getBoundingClientRect').mockReturnValue({ height: 42.5 } as DOMRect);
    measure([], {} as ResizeObserver);
    expectNotification('resize', { height: 43, contentHeight: 0 });
    expect(postMessage.mock.calls.some(([value]) => value.type === 'blocked')).toBe(false);
  });

  test('reports only changed dimensions while preserving content-only changes and shrinking', async () => {
    initialize();
    message();
    await flush();
    postMessage.mockClear();
    measure([], {} as ResizeObserver);
    expect(postMessage).not.toHaveBeenCalled();

    const content = document.querySelector<HTMLElement>('.markdown-html')!;
    const bounds = jest.spyOn(content, 'getBoundingClientRect').mockReturnValue({ height: 42.5 } as DOMRect);
    const child = content.firstElementChild!;
    Object.defineProperty(child, 'offsetHeight', { configurable: true, value: 30 });
    measure([], {} as ResizeObserver);
    bounds.mockReturnValue({ height: 42.8 } as DOMRect);
    measure([], {} as ResizeObserver);
    Object.defineProperty(child, 'offsetHeight', { configurable: true, value: 20 });
    measure([], {} as ResizeObserver);
    bounds.mockReturnValue({ height: 25 } as DOMRect);
    measure([], {} as ResizeObserver);
    content.replaceChildren();
    bounds.mockReturnValue({ height: 0 } as DOMRect);
    measure([], {} as ResizeObserver);
    measure([], {} as ResizeObserver);
    expect(postMessage.mock.calls.map(([notification]) => notification)).toEqual([
      {
        protocol: TEXT_FRAME_PROTOCOL,
        channel: command.channel,
        revision: 0,
        type: 'resize',
        height: 43,
        contentHeight: 30,
      },
      {
        protocol: TEXT_FRAME_PROTOCOL,
        channel: command.channel,
        revision: 0,
        type: 'resize',
        height: 43,
        contentHeight: 20,
      },
      {
        protocol: TEXT_FRAME_PROTOCOL,
        channel: command.channel,
        revision: 0,
        type: 'resize',
        height: 25,
        contentHeight: 20,
      },
      {
        protocol: TEXT_FRAME_PROTOCOL,
        channel: command.channel,
        revision: 0,
        type: 'resize',
        height: 1,
        contentHeight: 0,
      },
    ]);
  });

  test('waits for an enforced probe violation before accepting protected HTML', async () => {
    initialize(policy);
    expect(document.querySelector('img')).toHaveAttribute('src', CSP_CHECK_URL);
    message();
    violation(CSP_CHECK_URL, { disposition: 'report' });
    violation('https://unrelated.test/image');
    await flush();
    expect(postMessage).not.toHaveBeenCalled();
    expect(document.querySelector('.markdown-html')).toBeNull();
    violation(CSP_CHECK_URL);
    violation(new URL(CSP_CHECK_URL).origin);
    await flush();
    expectNotification('ready', { document: expect.any(String) });
    expect(document.querySelector('img')).toBeNull();
    message();
    await flush();
    expect(document.querySelector('p')).toHaveTextContent('Visible content');
    expectNotification('rendered');
  });

  test('groups blocked URLs by origin and keeps reporting later violations', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    message();
    await flush();
    violation('https://external.test/one?secret=1');
    violation('https://external.test/two?secret=2');
    violation('https://external.test/one?secret=1');
    await flush();
    expectNotification('blocked', {
      resources: [
        {
          directive: 'img-src',
          origin: 'https://external.test',
          urls: [
            { url: 'https://external.test/one?secret=1', count: 2 },
            { url: 'https://external.test/two?secret=2', count: 1 },
          ],
        },
      ],
    });
    postMessage.mockClear();
    violation('https://other.test/image', { originalPolicy: 'deployment policy' });
    violation('inline', { effectiveDirective: 'script-src' });
    violation('inline', { effectiveDirective: 'script-src' });
    await flush();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0].resources.slice(1)).toEqual([
      { directive: 'img-src', origin: undefined },
      { directive: 'script-src', origin: undefined },
    ]);
    expect(document.querySelector('p')).toBeVisible();
    expect(disconnect).not.toHaveBeenCalled();
  });

  test('counts every element using a blocked URL, since browsers may report a repeated image once', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    const url = 'https://external.test/avatar.png';
    message({ ...command, html: `<img src="${url}"><img src="${url}"><img src="${url}">` });
    await flush();
    violation(url);
    await flush();
    expectNotification('blocked', {
      resources: [{ directive: 'img-src', origin: 'https://external.test', urls: [{ url, count: 3 }] }],
    });
  });

  test('counts references with a fragment and video posters, which CSP reports without the fragment', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    const url = 'https://external.test/avatar.png';
    message({ ...command, html: `<img src="${url}#a"><img src="${url}#b"><video poster="${url}"></video>` });
    await flush();
    violation(url);
    await flush();
    expectNotification('blocked', {
      resources: [{ directive: 'img-src', origin: 'https://external.test', urls: [{ url, count: 3 }] }],
    });
  });

  test('reports a long URL in full', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    message();
    await flush();
    const long = `https://external.test/collect?d=${'x'.repeat(10_000)}`;
    violation(long);
    await flush();
    const [resource] = postMessage.mock.calls.at(-1)![0].resources;
    expect(resource.urls).toEqual([{ url: long, count: 1 }]);
    expect(resource.truncated).toBeUndefined();
  });

  test('marks the report as truncated once the URLs go over the budget', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    message();
    await flush();
    const url = (index: number) => `https://external.test/${index}?d=${'x'.repeat(1000)}`;
    const fits = Math.floor(MAX_BLOCKED_URL_CHARS / url(0).length);
    for (let index = 0; index <= fits; index++) {
      violation(url(index));
    }
    await flush();
    const [resource] = postMessage.mock.calls.at(-1)![0].resources;
    expect(resource.urls).toHaveLength(fits);
    expect(resource.truncated).toBe(true);
  });

  test('ignores unauthenticated, malformed, and duplicate render commands', async () => {
    initialize();
    message(command, 'https://attacker.test');
    message(command, parentOrigin, null);
    for (const invalid of [
      null,
      {},
      { ...command, channel: 'wrong' },
      { ...command, protocol: 'wrong' },
      { ...command, type: 'unknown' },
      { ...command, html: 1 },
      { ...command, globalCss: 1 },
    ]) {
      message(invalid);
    }
    expect(document.querySelector('.markdown-html')).toBeNull();
    message();
    message({ ...command, html: '<p>Duplicate</p>' });
    await flush();
    expect(document.querySelectorAll('.markdown-html')).toHaveLength(1);
    expect(document.body).not.toHaveTextContent('Duplicate');
  });

  test('loads Mermaid on demand and reports failure when its script does not register', async () => {
    initialize();
    message({ ...command, html: '<pre class="mermaid">graph LR; A-->B</pre>', mermaid: {} });
    await flush();
    expectNotification('mermaid-needed');
    message({ ...command, type: 'mermaid-source', source: '' });
    await flush();
    expectNotification('error');
  });

  test('renders with the registered Mermaid renderer', async () => {
    initialize();
    const renderer = jest.fn().mockResolvedValue(undefined);
    const append = document.head.append.bind(document.head);
    jest.spyOn(document.head, 'append').mockImplementation((...nodes) => {
      for (const node of nodes) {
        if (node instanceof HTMLScriptElement && 'registerMermaid' in node) {
          (node.registerMermaid as (render: typeof renderer) => void)(renderer);
          expect(node.nonce).toBe('test-nonce');
        }
      }
      append(...nodes);
    });
    message({ ...command, html: '<pre class="mermaid">graph LR; A-->B</pre>', mermaid: {} });
    await flush();
    message({ ...command, type: 'mermaid-source', source: '/* trusted runtime */' });
    await flush();
    expect(renderer).toHaveBeenCalled();
    expect(renderer.mock.calls[0][2]()).toBe(false);
    expectNotification('rendered');
    window.dispatchEvent(new Event('pagehide'));
    expect(renderer.mock.calls[0][2]()).toBe(true);
  });

  test('replaces protected content while retaining the stylesheet and resetting measurements', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    message();
    await flush();
    const style = document.head.querySelector('style')!;
    const text = style.firstChild;
    const oldContent = document.querySelector('.markdown-html')!;
    postMessage.mockClear();
    message({ ...command, revision: 1, html: '<p>Updated content</p>', globalCss: undefined });
    message({ ...command, revision: 0, html: '<p>Stale content</p>' });
    await flush();
    expect(document.body).toHaveTextContent('Updated content');
    expect(oldContent.isConnected).toBe(false);
    expect(document.head.querySelectorAll('style')).toHaveLength(1);
    expect(style.firstChild).toBe(text);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expectNotification('rendered', { revision: 1 });
    expectNotification('resize', { revision: 1, height: 1, contentHeight: 0 });
    expect(postMessage.mock.calls.every(([notification]) => notification.revision === 1)).toBe(true);
  });

  test('requires initial CSS but accepts an explicit empty stylesheet on updates', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    message({ ...command, globalCss: undefined });
    expect(document.querySelector('.markdown-html')).toBeNull();
    message();
    await flush();
    expect(document.head.querySelector('style')).toHaveTextContent('p{color:red}');
    message({ ...command, revision: 1, globalCss: '' });
    await flush();
    expectNotification('rendered', { revision: 1 });
    expect(document.head.querySelector('style')).not.toHaveTextContent('p{color:red}');
  });

  test.each([undefined, policy])(
    'updates styles without replacing content or resetting reports (policy: %s)',
    async (framePolicy) => {
      initialize(framePolicy);
      if (framePolicy) {
        violation(CSP_CHECK_URL);
        await flush();
      }
      const styles = {
        protocol: TEXT_FRAME_PROTOCOL,
        channel: command.channel,
        type: 'styles',
        revision: 0,
        styleRevision: 1,
        globalCss: 'p{color:blue}',
      };
      message(styles);
      expect(document.head.querySelector('style')).toBeNull();
      message({ ...command, html: '<input value="initial"><p>Content</p>' });
      await flush();
      const input = document.querySelector('input')!;
      input.value = 'edited';
      if (framePolicy) {
        violation('https://blocked.test/first.png');
        await flush();
      }
      message(styles, 'https://wrong.test');
      message(styles, parentOrigin, null);
      message({ ...styles, revision: 1 });
      expect(document.head.querySelector('style')).toHaveTextContent('p{color:red}');
      message(styles);
      await flush();
      expect(document.head.querySelector('style')).toHaveTextContent('p{color:blue}');
      expect(document.querySelector('input')).toBe(input);
      expect(input.value).toBe('edited');
      expect(disconnect).not.toHaveBeenCalled();
      for (const styleRevision of [1, 0, -1, 1.5, Infinity, undefined]) {
        message({ ...styles, styleRevision, globalCss: 'p{color:green}' });
      }
      expect(document.head.querySelector('style')).toHaveTextContent('p{color:blue}');
      if (framePolicy) {
        violation('https://blocked.test/second.png');
        await flush();
        expectNotification('blocked', {
          resources: [
            {
              directive: 'img-src',
              origin: 'https://blocked.test',
              urls: [
                { url: 'https://blocked.test/first.png', count: 1 },
                { url: 'https://blocked.test/second.png', count: 1 },
              ],
            },
          ],
        });
      }
    }
  );

  test('cancels pending Mermaid loads and serializes overlapping diagram renders', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    let finish!: () => void;
    const renderer = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const append = document.head.append.bind(document.head);
    jest.spyOn(document.head, 'append').mockImplementation((...nodes) => {
      for (const node of nodes) {
        if (node instanceof HTMLScriptElement && 'registerMermaid' in node) {
          (node.registerMermaid as (render: typeof renderer) => void)(renderer);
        }
      }
      append(...nodes);
    });
    const diagram = { ...command, html: '<pre class="mermaid">graph LR; A-->B</pre>', mermaid: {} };
    message(diagram);
    await flush();
    message({ ...diagram, revision: 1 });
    await flush();
    message({ ...command, type: 'mermaid-source', source: '/* old source */' });
    await flush();
    expect(renderer).not.toHaveBeenCalled();
    message({ ...command, revision: 1, type: 'mermaid-source', source: '/* current source */' });
    await flush();
    expect(renderer).toHaveBeenCalledTimes(1);
    const cancelled = renderer.mock.calls[0][2];
    expect(cancelled()).toBe(false);
    message({ ...command, type: 'styles', revision: 1, styleRevision: 1, globalCss: 'p{color:blue}' });
    await flush();
    expect(cancelled()).toBe(false);
    expect(renderer).toHaveBeenCalledTimes(1);
    expect(document.head.querySelector('style')).toHaveTextContent('p{color:blue}');

    message({ ...command, revision: 2, html: '<p>No diagram</p>' });
    await flush();
    expectNotification('rendered', { revision: 2 });
    expect(cancelled()).toBe(true);
    message({ ...diagram, revision: 3 });
    await flush();
    expect(renderer).toHaveBeenCalledTimes(1);
    postMessage.mockClear();
    finish();
    await flush();
    expectNotification('mermaid-needed', { revision: 3 });
    expect(postMessage.mock.calls.some(([notification]) => notification.type === 'rendered')).toBe(false);
    message({ ...command, revision: 3, type: 'mermaid-source', source: '/* new source */' });
    await flush();
    expect(renderer).toHaveBeenCalledTimes(2);
    expectNotification('rendered', { revision: 3 });
  });

  test('ignores font completion from superseded style updates', async () => {
    initialize();
    message();
    await flush();
    const content = document.querySelector<HTMLElement>('.markdown-html')!;
    const bounds = jest.spyOn(content, 'getBoundingClientRect').mockReturnValue({ height: 42 } as DOMRect);
    const originalReady = document.fonts.ready;
    let finish!: () => void;
    Object.defineProperty(document.fonts, 'ready', {
      configurable: true,
      value: new Promise<void>((resolve) => {
        finish = resolve;
      }),
    });
    try {
      message({ ...command, type: 'styles', styleRevision: 1, globalCss: 'p{color:blue}' });
      Object.defineProperty(document.fonts, 'ready', { value: Promise.resolve(document.fonts) });
      message({ ...command, type: 'styles', styleRevision: 2, globalCss: 'p{color:green}' });
      await flush();
      expectNotification('resize', { height: 42, contentHeight: 0 });
      expect(bounds).toHaveBeenCalledTimes(1);
      finish();
      await flush();
      expect(bounds).toHaveBeenCalledTimes(1);
      expect(document.head.querySelector('style')).toHaveTextContent('p{color:green}');
    } finally {
      Object.defineProperty(document.fonts, 'ready', { value: originalReady });
    }
  });

  test('supersedes a render waiting for fonts without reporting stale completion', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    let finish!: () => void;
    const originalReady = document.fonts.ready;
    Object.defineProperty(document.fonts, 'ready', {
      configurable: true,
      value: new Promise<FontFaceSet>((resolve) => {
        finish = () => resolve(document.fonts);
      }),
    });
    message();
    message({ ...command, revision: 1, html: '<p>Latest</p>' });
    postMessage.mockClear();
    finish();
    await flush();
    expect(document.body).toHaveTextContent('Latest');
    expectNotification('rendered', { revision: 1 });
    expect(postMessage.mock.calls.every(([notification]) => notification.revision === 1)).toBe(true);
    Object.defineProperty(document.fonts, 'ready', { value: originalReady });
  });

  test('unloading cancels pending diagrams, reports, and resize observation', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    message({ ...command, html: '<pre class="mermaid">graph LR; A-->B</pre>', mermaid: {} });
    await flush();
    violation('https://external.test/image');
    postMessage.mockClear();
    window.dispatchEvent(new Event('pagehide'));
    measure([], {} as ResizeObserver);
    message();
    await flush();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(postMessage).not.toHaveBeenCalled();
  });

  test('creates frame-local HTML and script policies without granting script URL trust', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'trustedTypes');
    const createScript = jest.fn((source: string) => source);
    const createPolicy = jest.fn((name: string, options: TrustedTypePolicyOptions) =>
      name === 'default' ? options : { createScript: (source: string) => createScript(options.createScript!(source)) }
    );
    Object.defineProperty(window, 'trustedTypes', { configurable: true, value: { createPolicy } });
    try {
      initialize();
      const htmlOptions = createPolicy.mock.calls[0][1];
      expect(createPolicy.mock.calls.map(([name]) => name)).toEqual(['default', 'grafana-text-panel-runtime']);
      expect(htmlOptions.createHTML!('<SCRIPT>untrusted</SCRIPT>')).toBe('&lt;script>untrusted</SCRIPT>');
      expect(htmlOptions.createScript).toBeUndefined();
      expect(createPolicy.mock.calls[1][1].createScriptURL).toBeUndefined();
      message({ ...command, html: '<pre class="mermaid">graph LR; A-->B</pre>', mermaid: {} });
      await flush();
      message({ ...command, type: 'mermaid-source', source: '/* trusted Mermaid */' });
      await flush();
      expect(createScript).toHaveBeenCalledWith('/* trusted Mermaid */');
    } finally {
      if (original) {
        Object.defineProperty(window, 'trustedTypes', original);
      } else {
        Reflect.deleteProperty(window, 'trustedTypes');
      }
    }
  });
});

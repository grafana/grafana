import { CSP_CHECK_URL, TEXT_FRAME_PROTOCOL } from './sandboxProtocol';

const parentOrigin = 'https://grafana.test';
const policy = "default-src 'none'";
const command = {
  protocol: TEXT_FRAME_PROTOCOL,
  channel: 'test-channel',
  type: 'render',
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
      { type, protocol: TEXT_FRAME_PROTOCOL, channel: command.channel, ...fields },
      parentOrigin
    );
  }

  test('requires a bootstrap script', () => {
    jest.spyOn(document, 'currentScript', 'get').mockReturnValue(null);
    expect(() => jest.isolateModules(() => require('./sandboxRuntime'))).toThrow('bootstrap script');
  });

  test('legacy content renders without policy verification and keeps measuring', async () => {
    initialize();
    expectNotification('ready');
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
    expectNotification('ready');
    expect(document.querySelector('img')).toBeNull();
    message();
    await flush();
    expect(document.querySelector('p')).toHaveTextContent('Visible content');
    expectNotification('rendered');
  });

  test('deduplicates resource origins and continues reporting later violations', async () => {
    initialize(policy);
    violation(CSP_CHECK_URL);
    await flush();
    message();
    await flush();
    violation('https://external.test/one?secret=1');
    violation('https://external.test/two?secret=2');
    await flush();
    const resources = [{ directive: 'img-src', origin: 'https://external.test' }];
    expectNotification('blocked', { resources });
    postMessage.mockClear();
    violation('https://external.test/three');
    await flush();
    expect(postMessage).not.toHaveBeenCalled();
    violation('https://other.test/image', { originalPolicy: 'deployment policy' });
    violation('inline', { effectiveDirective: 'script-src' });
    await flush();
    expectNotification('blocked', {
      resources: [
        ...resources,
        { directive: 'img-src', origin: undefined },
        { directive: 'script-src', origin: undefined },
      ],
    });
    expect(document.querySelector('p')).toBeVisible();
    expect(disconnect).not.toHaveBeenCalled();
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
});

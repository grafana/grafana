/** @jest-environment jsdom */

// Happy DOM does not implement the video poster property used to count blocked resources.
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

  beforeEach(() => {
    jest.useFakeTimers();
    postMessage = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
    jest.spyOn(window, 'ResizeObserver').mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  afterEach(() => {
    window.dispatchEvent(new Event('pagehide'));
    document.body.replaceChildren();
    document.head.querySelectorAll('style').forEach((style) => style.remove());
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  function initialize(customPolicy: string) {
    const script = document.createElement('script');
    script.dataset.channel = command.channel;
    script.dataset.parentOrigin = parentOrigin;
    script.nonce = 'test-nonce';
    script.dataset.policy = customPolicy;
    document.body.append(script);
    jest.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
    jest.isolateModules(() => require('./sandboxRuntime'));
    expect(script.isConnected).toBe(false);
  }

  function message(data: unknown) {
    window.dispatchEvent(new MessageEvent('message', { data, origin: parentOrigin, source: window }));
  }

  function violation(blockedURI: string) {
    document.dispatchEvent(
      Object.assign(new Event('securitypolicyviolation'), {
        blockedURI,
        disposition: 'enforce',
        effectiveDirective: 'img-src',
        originalPolicy: policy,
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
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';

import { SandboxFrame, type SandboxFrameProps, WATCHDOG_TIMEOUT_MS } from './SandboxFrame';
import { TextSandbox } from './TextSandbox';
import { loadSandboxMermaid, loadSandboxRuntime } from './loadSandboxRuntime';
import { MAX_BLOCKED_URL_CHARS, textSandboxPolicy } from './sandboxPolicy';
import { TEXT_FRAME_PROTOCOL } from './sandboxProtocol';

jest.mock('./loadSandboxRuntime', () => ({
  loadSandboxRuntime: jest.fn(() => Promise.resolve('/* trusted runtime */')),
  loadSandboxMermaid: jest.fn(() => Promise.resolve('/* trusted Mermaid */')),
}));

function props(overrides: Partial<SandboxFrameProps> = {}): SandboxFrameProps {
  return {
    html: '<p>Private content</p>',
    globalCss: '',
    policy: textSandboxPolicy([], '/public/fonts/'),
    title: 'Text content',
    onState: jest.fn(),
    onHeight: jest.fn(),
    ...overrides,
  };
}

async function frame() {
  await act(async () => {});
  return screen.getByTitle<HTMLIFrameElement>('Text content');
}

const notifications = new WeakMap<HTMLIFrameElement, { document: string; revision: number }>();

function notify(frame: HTMLIFrameElement, type: string, extra = {}, envelope = {}) {
  const current = notifications.get(frame) ?? { document: 'first', revision: 0 };
  if (type === 'ready' && 'document' in extra && extra.document !== current.document) {
    current.document = String(extra.document);
    current.revision++;
  }
  notifications.set(frame, current);
  const shell = new DOMParser().parseFromString(frame.srcdoc, 'text/html');
  const channel = shell.querySelector('script')!.dataset.channel;
  fireEvent(
    window,
    new MessageEvent('message', {
      source: frame.contentWindow,
      origin: frame.hasAttribute('sandbox') ? 'null' : window.location.origin,
      data: {
        protocol: TEXT_FRAME_PROTOCOL,
        channel,
        revision: current.revision,
        type,
        ...(type === 'ready' && { document: 'first' }),
        ...extra,
      },
      ...envelope,
    })
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(loadSandboxMermaid).mockClear();
});
afterEach(() => jest.useRealTimers());

it.each([
  { name: 'protected', policy: textSandboxPolicy([], '/public/fonts/') },
  { name: 'legacy', policy: undefined },
])('disables DNS prefetch before loading the $name frame runtime', async ({ policy }) => {
  render(<SandboxFrame {...props({ policy })} />);
  const element = await frame();
  const shell = new DOMParser().parseFromString(element.srcdoc, 'text/html');
  const control = shell.head.querySelector('meta[http-equiv="x-dns-prefetch-control"]');
  expect(control?.getAttribute('content')).toBe('off');
  expect(shell.head.firstElementChild).toBe(control);
  expect(control!.compareDocumentPosition(shell.querySelector('script')!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(shell.body.childNodes).toHaveLength(1);
});

it('mounts visibly immediately but sends data only after the current runtime is ready', async () => {
  const options = props();
  render(
    <StrictMode>
      <SandboxFrame {...options} />
    </StrictMode>
  );
  const initial = screen.getByTitle('Text content');
  expect(initial).toBeVisible();
  expect(initial).not.toHaveAttribute('srcdoc');
  const element = await frame();
  expect(element).toBe(initial);
  expect(element).toHaveAttribute('srcdoc', expect.stringContaining('trusted runtime'));
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  expect(element.srcdoc).not.toContain('Private content');
  expect(element.getAttribute('sandbox')).toContain('allow-scripts');
  expect(element.getAttribute('sandbox')).not.toContain('allow-same-origin');
  expect(element).toBeVisible();
  expect(postMessage).not.toHaveBeenCalled();
  notify(element, 'ready');
  expect(postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'render', html: '<p>Private content</p>' }),
    '*'
  );
  expect(element).toBeVisible();
  notify(element, 'rendered');
  expect(element).toBeVisible();
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });
});

it('rejects foreign sources, origins, channels, and premature rendered messages', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(element, 'ready', {}, { source: window });
  notify(element, 'ready', {}, { origin: 'https://other.test' });
  notify(element, 'ready', { channel: 'wrong' });
  notify(element, 'rendered');
  expect(element).toBeVisible();
  expect(postMessage).not.toHaveBeenCalled();
  notify(element, 'ready');
  notify(element, 'ready');
  expect(postMessage).toHaveBeenCalledTimes(1);
});

it('renders again into a reloaded document and fails closed if it never completes', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(element, 'ready');
  notify(element, 'rendered');
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });

  notify(element, 'ready', { document: 'reloaded' });
  notify(element, 'ready', { document: 'reloaded' });
  expect(postMessage).toHaveBeenCalledTimes(2);
  expect(postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'render', html: '<p>Private content</p>' }),
    '*'
  );

  act(() => jest.advanceTimersByTime(WATCHDOG_TIMEOUT_MS));
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'error', resources: [] });
});

it('renders into a reloaded document after the previous document failed', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(element, 'ready');
  notify(element, 'error');
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'error', resources: [] });

  notify(element, 'ready', { document: 'reloaded' });
  expect(postMessage).toHaveBeenCalledTimes(2);
  expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'render' }), '*');
  notify(element, 'rendered');
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });
});

it('retains the visible frame and reports a late violation', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'ready');
  notify(element, 'rendered');
  expect(element).toBeVisible();
  notify(element, 'rendered');
  expect(element).toBeVisible();
  notify(element, 'blocked', { resources: [{ directive: 'img-src', origin: 'https://external.test/secret' }] });
  expect(element).toBeInTheDocument();
  expect(options.onState).toHaveBeenLastCalledWith({
    status: 'ready',
    resources: [{ directive: 'img-src', origin: 'https://external.test' }],
  });
});

it('merges reported URLs per origin, keeping the highest count and dropping URLs from other origins', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'ready');
  const origin = 'https://external.test';
  notify(element, 'blocked', {
    resources: [
      {
        directive: 'img-src',
        origin,
        urls: [
          { url: `${origin}/a.png`, count: 1 },
          { url: 'https://elsewhere.test/b.png', count: 1 },
        ],
      },
    ],
  });
  notify(element, 'blocked', {
    resources: [
      {
        directive: 'img-src',
        origin,
        urls: [
          { url: `${origin}/a.png`, count: 4 },
          { url: `${origin}/c.png`, count: 1 },
        ],
      },
    ],
  });
  expect(options.onState).toHaveBeenLastCalledWith({
    status: 'loading',
    resources: [
      {
        directive: 'img-src',
        origin,
        urls: [
          { url: `${origin}/a.png`, count: 4 },
          { url: `${origin}/c.png`, count: 1 },
        ],
      },
    ],
  });
  const count = jest.mocked(options.onState).mock.calls.length;
  notify(element, 'blocked', {
    resources: [{ directive: 'img-src', origin, urls: [{ url: `${origin}/a.png`, count: 2 }] }],
  });
  expect(options.onState).toHaveBeenCalledTimes(count);
});

it('keeps the truncated flag from a report', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'ready');
  const urls = [{ url: 'https://external.test/collect?d=x', count: 1 }];
  notify(element, 'blocked', {
    resources: [{ directive: 'img-src', origin: 'https://external.test', urls, truncated: true }],
  });
  expect(options.onState).toHaveBeenLastCalledWith({
    status: 'loading',
    resources: [{ directive: 'img-src', origin: 'https://external.test', urls, truncated: true }],
  });
});

it.each([
  ['a non-string URL', [{ url: 1, count: 1 }]],
  ['a zero count', [{ url: 'https://external.test/a.png', count: 0 }]],
  ['URLs over the budget', [{ url: `https://external.test/${'x'.repeat(MAX_BLOCKED_URL_CHARS)}`, count: 1 }]],
])('ignores reports with %s', async (_, urls) => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'ready');
  notify(element, 'blocked', { resources: [{ directive: 'img-src', origin: 'https://external.test', urls }] });
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'loading', resources: [] });
});

it('omits CSP and sandbox completely without data', async () => {
  render(<SandboxFrame {...props({ policy: undefined, html: '<script>legacy()</script>' })} />);
  const element = await frame();
  expect(element.srcdoc).toContain('trusted runtime');
  expect(element.srcdoc).not.toContain('Content-Security-Policy');
  expect(element).not.toHaveAttribute('sandbox');
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(element, 'ready');
  expect(postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ html: '<script>legacy()</script>' }),
    window.location.origin
  );
});

it('accumulates normalized violations across rendering and errors while continuing to resize', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'blocked', { resources: [{ directive: 'img-src', origin: 'https://premature.test' }] });
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'loading', resources: [] });
  notify(element, 'ready');
  const first = { directive: 'img-src', origin: 'https://first.test' };
  const second = { directive: 'media-src', origin: 'https://second.test' };
  notify(element, 'blocked', { resources: [{ ...first, origin: first.origin + '/private?data=secret' }] });
  notify(element, 'rendered');
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [first] });
  const count = jest.mocked(options.onState).mock.calls.length;
  notify(element, 'blocked', { resources: [first] });
  expect(options.onState).toHaveBeenCalledTimes(count);
  notify(element, 'error');
  const errorCount = jest.mocked(options.onState).mock.calls.length;
  notify(element, 'error');
  expect(options.onState).toHaveBeenCalledTimes(errorCount);
  notify(element, 'blocked', { resources: [first, second] });
  notify(element, 'rendered');
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'error', resources: [first, second] });
  notify(element, 'resize', { height: 220, contentHeight: 200 });
  expect(options.onHeight).toHaveBeenLastCalledWith(220, 200);
  expect(screen.getByTitle('Text content')).toBe(element);
  expect(element).toBeVisible();
});

it('finishes Mermaid loading despite an unrelated CSP violation', async () => {
  let resolve!: (source: string) => void;
  jest.mocked(loadSandboxMermaid).mockReturnValueOnce(new Promise((done) => (resolve = done)));
  const options = props({ mermaid: {} });
  render(<SandboxFrame {...options} />);
  const element = await frame();
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(element, 'ready');
  notify(element, 'mermaid-needed');
  notify(element, 'blocked', { resources: [{ directive: 'img-src', origin: 'https://external.test' }] });
  await act(async () => resolve('Mermaid runtime'));
  expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'mermaid-source' }), '*');
});

it('updates height and pagination metrics only from valid runtime messages', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'ready');
  notify(element, 'resize', { height: 180, contentHeight: 160 });
  expect(element.style.height).toBe('180px');
  expect(element).toHaveAttribute('data-text-content-height', '160');
  expect(options.onHeight).toHaveBeenLastCalledWith(180, 160);
  notify(element, 'resize', { height: -1, contentHeight: Infinity });
  expect(element.style.height).toBe('180px');
});

it.each(['dark', 'light'])(
  'declares the host %s color scheme so the empty shell paints transparent',
  async (scheme) => {
    const original = window.getComputedStyle;
    const spy = jest.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = original(element, pseudo);
      return element instanceof HTMLIFrameElement ? ({ ...style, colorScheme: scheme } as CSSStyleDeclaration) : style;
    });
    try {
      render(<SandboxFrame {...props()} />);
      const element = await frame();
      const shell = new DOMParser().parseFromString(element.srcdoc, 'text/html');
      expect(shell.head.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe(scheme);
    } finally {
      spy.mockRestore();
    }
  }
);

it('is a block element so its baseline gap cannot overflow a container sized to the frame', async () => {
  render(<SandboxFrame {...props()} />);
  expect((await frame()).style.display).toBe('block');
});

it('fills the minimum height without reporting it as content height', async () => {
  const options = props({ minHeight: 300 });
  render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'ready');
  notify(element, 'resize', { height: 11, contentHeight: 11 });
  expect(element.style.height).toBe('300px');
  expect(element).toHaveAttribute('data-text-content-height', '11');
  expect(options.onHeight).toHaveBeenLastCalledWith(11, 11);
  notify(element, 'resize', { height: 450, contentHeight: 450 });
  expect(element.style.height).toBe('450px');
});

it.each(['policy', 'globalCss'] as const)('recreates on %s changes and ignores the old generation', async (field) => {
  const options = props();
  const { rerender } = render(<SandboxFrame {...options} />);
  const previous = await frame();
  const staleWindow = previous.contentWindow;
  const staleChannel = new DOMParser().parseFromString(previous.srcdoc, 'text/html').querySelector('script')!.dataset
    .channel;
  notify(previous, 'ready');
  rerender(<SandboxFrame {...options} {...{ [field]: field === 'policy' ? undefined : options[field] + ' ' }} />);
  const current = await frame();
  expect(current).not.toBe(previous);
  notify(current, 'blocked', { resources: [{ directive: 'img-src' }], channel: staleChannel }, { source: staleWindow });
  expect(current).toBeVisible();
  notify(current, 'ready');
  notify(current, 'rendered');
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });
});

it('fails closed if bootstrap or rendering never completes', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  expect(element.srcdoc).not.toContain('Private content');
  act(() => jest.advanceTimersByTime(WATCHDOG_TIMEOUT_MS));
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'error', resources: [] });
  expect(element).toBeInTheDocument();
});

it.each([
  { name: 'Mermaid configuration', update: { mermaid: { securityLevel: 'strict' as const } } },
  { name: 'diagram error message', update: { diagramError: 'Updated error' } },
])('recreates the document when $name changes', async ({ update }) => {
  const options = props();
  const { rerender } = render(<SandboxFrame {...options} />);
  const previous = await frame();
  rerender(<SandboxFrame {...options} {...update} />);
  const current = await frame();
  expect(current).not.toBe(previous);
  const postMessage = jest.spyOn(current.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(current, 'ready');
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'render', ...update }), '*');
});

it('retains the document on consumer changes and clears reports only on replacement or unmount', async () => {
  const options = props();
  const { rerender, unmount } = render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'ready');
  notify(element, 'rendered');
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });
  expect(options.onState).not.toHaveBeenCalledWith(undefined);

  const onState = jest.fn();
  const onHeight = jest.fn();
  rerender(<SandboxFrame {...options} title="Updated title" onState={onState} onHeight={onHeight} />);
  expect(screen.getByTitle('Updated title')).toBe(element);
  expect(options.onState).toHaveBeenLastCalledWith(undefined);
  expect(onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });
  notify(element, 'resize', { height: 180, contentHeight: 160 });
  expect(onHeight).toHaveBeenLastCalledWith(180, 160);
  expect(onState).toHaveBeenCalledTimes(1);
  unmount();
  expect(onState.mock.calls).toEqual([[{ status: 'ready', resources: [] }], [undefined]]);
});

it('reports runtime loading failure without navigating the frame', async () => {
  jest.mocked(loadSandboxRuntime).mockRejectedValueOnce(new Error('Chunk unavailable'));
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'error', resources: [] });
  expect(element).not.toHaveAttribute('srcdoc');
  const errorCount = jest.mocked(options.onState).mock.calls.length;
  act(() => jest.runAllTimers());
  expect(options.onState).toHaveBeenCalledTimes(errorCount);
});

it('discards bootstrap completion for a replaced document', async () => {
  let resolve!: (source: string) => void;
  jest.mocked(loadSandboxRuntime).mockReturnValueOnce(new Promise((done) => (resolve = done)));
  const options = props();
  const { rerender } = render(<SandboxFrame {...options} />);
  const previous = screen.getByTitle<HTMLIFrameElement>('Text content');
  rerender(<SandboxFrame {...options} globalCss="p{color:red}" />);
  const current = await frame();
  await act(async () => resolve('stale runtime'));
  expect(current.srcdoc).toContain('/* trusted runtime */');
  expect(previous).not.toHaveAttribute('srcdoc');
  expect(current.srcdoc).not.toContain('stale runtime');
});

it('escapes shell attributes and script terminators while reusing the deployment nonce', async () => {
  const deploymentScript = document.createElement('script');
  deploymentScript.nonce = 'server-nonce';
  document.head.append(deploymentScript);
  const policy = `script-src 'none'; img-src https://example.test/?q="quoted"&x=<value>`;
  jest.mocked(loadSandboxRuntime).mockResolvedValueOnce('const closingTag = "</ScRiPt><script>unexpected()</script>";');
  try {
    render(<SandboxFrame {...props({ policy })} />);
    const element = await frame();
    const shell = new DOMParser().parseFromString(element.srcdoc, 'text/html');
    const script = shell.querySelector('script')!;
    const expectedPolicy = `script-src 'nonce-server-nonce'; img-src https://example.test/?q="quoted"&x=<value>`;
    expect(script.getAttribute('nonce')).toBe('server-nonce');
    expect(script.dataset.policy).toBe(expectedPolicy);
    expect(shell.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content')).toBe(
      expectedPolicy
    );
    expect(script.dataset.parentOrigin).toBe(window.location.origin);
    expect(shell.querySelectorAll('script')).toHaveLength(1);
    expect(script.textContent).toBe('const closingTag = "<\\/script><script>unexpected()<\\/script>";');
  } finally {
    deploymentScript.remove();
  }
});

it('ignores runtime loading after unmount and clears the watchdog', async () => {
  let resolve!: (source: string) => void;
  jest.mocked(loadSandboxRuntime).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    })
  );
  const options = props();
  const { unmount } = render(<SandboxFrame {...options} />);
  expect(options.onState).toHaveBeenCalledWith({ status: 'loading', resources: [] });
  unmount();
  jest.mocked(options.onState).mockClear();
  await act(async () => resolve('late runtime'));
  act(() => jest.runAllTimers());
  expect(options.onState).not.toHaveBeenCalled();
});

it('loads Mermaid once only after a verified frame requests it', async () => {
  render(<SandboxFrame {...props({ mermaid: { securityLevel: 'strict' } })} />);
  const element = await frame();
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(element, 'mermaid-needed');
  notify(element, 'ready');
  notify(element, 'mermaid-needed', {}, { source: window });
  notify(element, 'mermaid-needed', {}, { origin: 'https://other.test' });
  notify(element, 'mermaid-needed', { channel: 'wrong' });
  expect(loadSandboxMermaid).not.toHaveBeenCalled();
  notify(element, 'mermaid-needed');
  notify(element, 'mermaid-needed');
  await act(async () => {});
  expect(loadSandboxMermaid).toHaveBeenCalledTimes(1);
  expect(postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'mermaid-source', source: '/* trusted Mermaid */' }),
    '*'
  );
  expect(element).toBeVisible();
  notify(element, 'rendered');
  expect(element).toBeVisible();
});

it('ignores Mermaid requests when diagrams are disabled', async () => {
  render(<SandboxFrame {...props()} />);
  const element = await frame();
  notify(element, 'ready');
  notify(element, 'mermaid-needed');
  notify(element, 'rendered');
  expect(element).toBeVisible();
  expect(loadSandboxMermaid).not.toHaveBeenCalled();
});

it.each(['refresh', 'unmount'] as const)('discards Mermaid loading after %s', async (action) => {
  let resolve!: (source: string) => void;
  jest.mocked(loadSandboxMermaid).mockReturnValueOnce(new Promise((done) => (resolve = done)));
  const options = props({ mermaid: { securityLevel: 'strict' } });
  const { rerender, unmount } = render(<SandboxFrame {...options} />);
  const element = await frame();
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(element, 'ready');
  notify(element, 'mermaid-needed');
  expect(loadSandboxMermaid).toHaveBeenCalledTimes(1);
  postMessage.mockClear();
  if (action === 'refresh') {
    rerender(<SandboxFrame {...options} html="<p>Refreshed</p>" />);
  } else if (action === 'unmount') {
    unmount();
  }
  await act(async () => resolve('late Mermaid source'));
  expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'mermaid-source' }), '*');
});

it('reports a Mermaid loading error without removing permitted content', async () => {
  jest.mocked(loadSandboxMermaid).mockRejectedValueOnce(new Error('Chunk unavailable'));
  const options = props({ mermaid: { securityLevel: 'strict' } });
  render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'ready');
  notify(element, 'mermaid-needed');
  await act(async () => {});
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'error', resources: [] });
  expect(element).toBeInTheDocument();
});

it.each(['error', 'timeout'] as const)('discards pending Mermaid source after %s', async (failure) => {
  let resolve!: (source: string) => void;
  jest.mocked(loadSandboxMermaid).mockReturnValueOnce(new Promise((done) => (resolve = done)));
  const options = props({ mermaid: {} });
  render(<SandboxFrame {...options} />);
  const element = await frame();
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(element, 'ready');
  notify(element, 'mermaid-needed');
  if (failure === 'timeout') {
    act(() => jest.advanceTimersByTime(WATCHDOG_TIMEOUT_MS));
  } else {
    notify(element, 'error');
  }
  await act(async () => resolve('late Mermaid source'));
  notify(element, 'rendered');
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'error', resources: [] });
  expect(postMessage).toHaveBeenCalledTimes(1);
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'render' }), '*');
});

it('ignores a Mermaid failure from the document before a reload', async () => {
  let reject!: (error: Error) => void;
  jest.mocked(loadSandboxMermaid).mockReturnValueOnce(new Promise((_, fail) => (reject = fail)));
  const options = props({ mermaid: {} });
  render(<SandboxFrame {...options} />);
  const element = await frame();
  jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(element, 'ready');
  notify(element, 'mermaid-needed');
  notify(element, 'ready', { document: 'reloaded' });
  notify(element, 'rendered');
  await act(async () => reject(new Error('Chunk failed')));
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });
});

it('fails closed on a forbidden shell policy and preserves TrustedHTML branding when permitted', async () => {
  const original = Object.getOwnPropertyDescriptor(window, 'trustedTypes');
  const createHTML = jest.fn((html: string) => ({ toString: () => html }));
  const createPolicy = jest
    .fn()
    .mockImplementationOnce(() => {
      throw new TypeError('Policy forbidden');
    })
    .mockReturnValue({ createHTML });
  Object.defineProperty(window, 'trustedTypes', { configurable: true, value: { createPolicy } });
  const setter = jest.spyOn(HTMLIFrameElement.prototype, 'srcdoc', 'set');
  try {
    const options = props();
    const view = render(<SandboxFrame {...options} />);
    const denied = await frame();
    expect(options.onState).toHaveBeenLastCalledWith({ status: 'error', resources: [] });
    expect(denied).not.toHaveAttribute('srcdoc');
    const errorCount = jest.mocked(options.onState).mock.calls.length;
    act(() => jest.runAllTimers());
    expect(options.onState).toHaveBeenCalledTimes(errorCount);
    view.rerender(<SandboxFrame {...options} globalCss="p{color:red}" html="<p>Refreshed secret</p>" />);
    await frame();
    expect(createPolicy).toHaveBeenCalledWith('grafana-text-panel-shell', expect.any(Object));
    const shell = createHTML.mock.calls[0][0];
    expect(shell).toContain('trusted runtime');
    expect(shell).not.toContain('Refreshed secret');
    expect(setter).toHaveBeenCalledWith(createHTML.mock.results[0].value);
    view.rerender(<SandboxFrame {...options} globalCss="p{color:blue}" html="<p>Another generation</p>" />);
    await frame();
    expect(createPolicy).toHaveBeenCalledTimes(2);
  } finally {
    setter.mockRestore();
    if (original) {
      Object.defineProperty(window, 'trustedTypes', original);
    } else {
      Reflect.deleteProperty(window, 'trustedTypes');
    }
  }
});

it.each([true, false])('renders before fonts finish (font available: %s)', async (ok) => {
  jest.useRealTimers();
  const originalFetch = global.fetch;
  const originalTimeout = AbortSignal.timeout;
  const style = document.createElement('style');
  style.dataset.emotion = 'text-global';
  style.textContent = `@font-face { font-family: Test; src: url("/public/fonts/startup-${ok}.woff2"); }`;
  document.head.append(style);
  // JSDOM does not expose CSSStyleSheet.ownerNode.
  Object.defineProperty(style.sheet, 'ownerNode', { value: style });
  let finish!: (response: Partial<Response>) => void;
  global.fetch = jest.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = (response) => resolve(response as Response);
      })
  );
  AbortSignal.timeout = () => new AbortController().signal;
  const runtime = jest.mocked(loadSandboxRuntime);
  runtime.mockClear();
  try {
    const { rerender } = render(<TextSandbox html="<p>Initial</p>" />);
    await act(async () => {});
    const fallback = screen.getByTitle<HTMLIFrameElement>('Text panel content');
    expect(runtime).toHaveBeenCalledTimes(1);
    const fallbackMessage = jest.spyOn(fallback.contentWindow!, 'postMessage').mockImplementation(() => {});
    notify(fallback, 'ready');
    expect(fallbackMessage).toHaveBeenCalledWith(
      expect.objectContaining({ html: '<p>Initial</p>', globalCss: expect.not.stringContaining('@font-face') }),
      '*'
    );
    rerender(<TextSandbox html="<p>Latest</p>" />);
    await act(async () => {
      finish({ ok, blob: async () => new Blob(['font'], { type: 'font/woff2' }) });
    });
    await waitFor(() => expect(runtime).toHaveBeenCalledTimes(2));
    const element = screen.getByTitle<HTMLIFrameElement>('Text panel content');
    expect(element).not.toBe(fallback);
    const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
    notify(element, 'ready');
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<p>Latest</p>',
        globalCss: expect.stringContaining(ok ? 'data:font/woff2;base64,Zm9udA==' : 'local("Arial")'),
      }),
      '*'
    );
    rerender(<TextSandbox html="<p>Latest</p>" minHeight={200} />);
    expect(screen.getByTitle('Text panel content')).toBe(element);
    expect(runtime).toHaveBeenCalledTimes(2);
  } finally {
    style.remove();
    global.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
  }
});

it('shares one message listener across frames and removes it after the last frame unmounts', async () => {
  const add = jest.spyOn(window, 'addEventListener');
  const remove = jest.spyOn(window, 'removeEventListener');
  const first = props({ title: 'First' });
  const second = props({ title: 'Second', policy: undefined });
  try {
    const { rerender, unmount } = render(
      <>
        <SandboxFrame key="first" {...first} />
        <SandboxFrame key="second" {...second} />
      </>
    );
    await act(async () => {});
    const firstFrame = screen.getByTitle<HTMLIFrameElement>('First');
    const secondFrame = screen.getByTitle<HTMLIFrameElement>('Second');
    const messageListeners = add.mock.calls.filter(([type]) => type === 'message');
    expect(messageListeners).toHaveLength(1);
    const listener = messageListeners[0][1];
    const firstPost = jest.spyOn(firstFrame.contentWindow!, 'postMessage').mockImplementation(() => {});
    const secondPost = jest.spyOn(secondFrame.contentWindow!, 'postMessage').mockImplementation(() => {});

    notify(firstFrame, 'ready', {}, { source: secondFrame.contentWindow });
    expect(firstPost).not.toHaveBeenCalled();
    notify(firstFrame, 'ready');
    expect(firstPost).toHaveBeenCalledWith(expect.objectContaining({ type: 'render' }), '*');
    expect(secondPost).not.toHaveBeenCalled();
    notify(secondFrame, 'ready');
    expect(secondPost).toHaveBeenCalledWith(expect.objectContaining({ type: 'render' }), window.location.origin);

    rerender(<SandboxFrame key="second" {...second} />);
    expect(remove).not.toHaveBeenCalledWith('message', listener);
    notify(secondFrame, 'rendered');
    expect(second.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });
    unmount();
    expect(remove).toHaveBeenCalledWith('message', listener);

    const remount = render(<SandboxFrame {...first} />);
    await act(async () => {});
    expect(add.mock.calls.filter(([type]) => type === 'message')).toHaveLength(2);
    const freshFrame = screen.getByTitle<HTMLIFrameElement>('First');
    notify(freshFrame, 'ready');
    notify(freshFrame, 'rendered');
    expect(first.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });
    remount.unmount();
  } finally {
    add.mockRestore();
    remove.mockRestore();
  }
});

it('notifies height consumers only when frame dimensions change', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'ready');
  notify(element, 'resize', { height: 180, contentHeight: 160 });
  notify(element, 'resize', { height: 180, contentHeight: 160 });
  expect(options.onHeight).toHaveBeenCalledTimes(1);
  expect(options.onHeight).toHaveBeenLastCalledWith(180, 160);
  notify(element, 'resize', { height: 180, contentHeight: 140 });
  expect(options.onHeight).toHaveBeenCalledTimes(2);
  expect(options.onHeight).toHaveBeenLastCalledWith(180, 140);
  notify(element, 'resize', { height: 150, contentHeight: 140 });
  expect(options.onHeight).toHaveBeenCalledTimes(3);
  expect(options.onHeight).toHaveBeenLastCalledWith(150, 140);
  expect(element.style.height).toBe('150px');
});

it('reuses protected documents for content updates and rejects replies from earlier renders', async () => {
  const options = props();
  const { rerender } = render(<SandboxFrame {...options} />);
  const element = await frame();
  const shell = element.srcdoc;
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  notify(element, 'ready');
  notify(element, 'rendered');
  rerender(<SandboxFrame {...options} html="<p>Updated</p>" />);
  expect(await frame()).toBe(element);
  expect(element.srcdoc).toBe(shell);
  expect(postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'render', revision: 1, html: '<p>Updated</p>', globalCss: undefined }),
    '*'
  );
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'loading', resources: [] });
  for (const revision of [0, undefined, -1, 1.5, Infinity]) {
    notify(element, 'rendered', { revision });
    notify(element, 'error', { revision });
    notify(element, 'resize', { revision, height: 999, contentHeight: 999 });
    notify(element, 'blocked', { revision, resources: [{ directive: 'img-src' }] });
  }
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'loading', resources: [] });
  expect(options.onHeight).not.toHaveBeenCalled();
  notify(element, 'rendered', { revision: 1 });
  notify(element, 'resize', { revision: 1, height: 42, contentHeight: 40 });
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });
  expect(options.onHeight).toHaveBeenLastCalledWith(42, 40);
  notify(element, 'ready', { document: 'reloaded' });
  expect(postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ html: '<p>Updated</p>', globalCss: options.globalCss, revision: 2 }),
    '*'
  );
});

it('sends only the latest content when updated before the CSP handshake', async () => {
  const options = props();
  const { rerender } = render(<SandboxFrame {...options} />);
  const element = await frame();
  const postMessage = jest.spyOn(element.contentWindow!, 'postMessage').mockImplementation(() => {});
  rerender(<SandboxFrame {...options} html="<p>Latest</p>" />);
  expect(await frame()).toBe(element);
  expect(postMessage).not.toHaveBeenCalled();
  notify(element, 'ready');
  expect(postMessage).toHaveBeenCalledTimes(1);
  expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ html: '<p>Latest</p>', revision: 1 }), '*');
  act(() => jest.advanceTimersByTime(WATCHDOG_TIMEOUT_MS));
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'error', resources: [] });
});

it('recreates legacy documents on content changes to discard script side effects', async () => {
  const options = props({ policy: undefined });
  const { rerender } = render(<SandboxFrame {...options} />);
  const element = await frame();
  rerender(<SandboxFrame {...options} html="<p>Updated</p>" />);
  expect(await frame()).not.toBe(element);
});

it('recreates blocked documents so unchanged stylesheet violations are reported again', async () => {
  const options = props();
  const { rerender } = render(<SandboxFrame {...options} />);
  const element = await frame();
  notify(element, 'ready');
  notify(element, 'blocked', { resources: [{ directive: 'font-src', origin: 'https://fonts.test' }] });
  rerender(<SandboxFrame {...options} html="<p>Updated</p>" />);
  const updated = await frame();
  expect(updated).not.toBe(element);
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'loading', resources: [] });
  notify(updated, 'ready');
  notify(updated, 'blocked', { resources: [{ directive: 'font-src', origin: 'https://fonts.test' }] });
  expect(options.onState).toHaveBeenLastCalledWith({
    status: 'loading',
    resources: [{ directive: 'font-src', origin: 'https://fonts.test' }],
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';

import { SandboxFrame, type SandboxFrameProps } from './SandboxFrame';
import { loadSandboxMermaid, loadSandboxRuntime } from './loadSandboxRuntime';
import { textSandboxPolicy } from './sandboxPolicy';
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

function notify(frame: HTMLIFrameElement, type: string, extra = {}, envelope = {}) {
  const shell = new DOMParser().parseFromString(frame.srcdoc, 'text/html');
  const channel = shell.querySelector('script')!.dataset.channel;
  fireEvent(
    window,
    new MessageEvent('message', {
      source: frame.contentWindow,
      origin: frame.hasAttribute('sandbox') ? 'null' : window.location.origin,
      data: { protocol: TEXT_FRAME_PROTOCOL, channel, type, ...extra },
      ...envelope,
    })
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(loadSandboxMermaid).mockClear();
});
afterEach(() => jest.useRealTimers());

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

it.each(['html', 'policy', 'globalCss'] as const)(
  'recreates on %s changes and ignores the old generation',
  async (field) => {
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
    notify(
      current,
      'blocked',
      { resources: [{ directive: 'img-src' }], channel: staleChannel },
      { source: staleWindow }
    );
    expect(current).toBeVisible();
    notify(current, 'ready');
    notify(current, 'rendered');
    expect(options.onState).toHaveBeenLastCalledWith({ status: 'ready', resources: [] });
  }
);

it('fails closed if bootstrap or rendering never completes', async () => {
  const options = props();
  render(<SandboxFrame {...options} />);
  const element = await frame();
  expect(element.srcdoc).not.toContain('Private content');
  act(() => jest.advanceTimersByTime(15000));
  expect(options.onState).toHaveBeenLastCalledWith({ status: 'error', resources: [] });
  expect(element).toBeInTheDocument();
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
  expect(postMessage).not.toHaveBeenCalled();
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

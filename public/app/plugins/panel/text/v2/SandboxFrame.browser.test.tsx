/** @jest-environment jsdom */

// These cases need nonce reflection and same-origin iframe messaging that Happy DOM does not implement.
import { act, fireEvent, render, screen } from '@testing-library/react';

import { SandboxFrame, type SandboxFrameProps } from './SandboxFrame';
import { loadSandboxRuntime } from './loadSandboxRuntime';
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
      data: { protocol: TEXT_FRAME_PROTOCOL, channel, type, ...(type === 'ready' && { document: 'first' }), ...extra },
      ...envelope,
    })
  );
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

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

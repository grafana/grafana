import { act, render, screen } from '@testing-library/react';

import { CoreApp, textUtil, toDataFrame } from '@grafana/data';
import config from 'app/core/config';
import { allowOrigins, getBlockedSummary } from 'app/features/dashboard-scene/scene/sandbox-consent/sandboxConsent';

import { TextMode } from '../panelcfg.gen';

import { SandboxFrame } from './SandboxFrame';
import { TextNGHtmlView } from './TextNGHtmlView';
import { TextNGPanel } from './TextNGPanel';
import { TextSandbox } from './TextSandbox';
import { createData, createProps, renderPanel } from './test-utils';

jest.mock('./SandboxFrame');

const mount = jest.mocked(SandboxFrame);

const intersectionObserverImplementation = jest.mocked(window.IntersectionObserver).getMockImplementation()!;
beforeEach(() => {
  mount.mockClear();
  jest.mocked(window.IntersectionObserver).mockClear().mockImplementation(intersectionObserverImplementation);
});

it('passes legacy embeds to the same renderer without a custom CSP', () => {
  render(<TextNGHtmlView html='<iframe title="Legacy embed" src="https://example.com"></iframe>' />);
  expect(screen.getByTitle('Legacy embed')).toHaveAttribute('src', 'https://example.com');
  expect(mount.mock.calls.at(-1)![0].policy).toBeUndefined();
});

it('protects even a zero-row dataframe and synchronously changes rendering mode when frames disappear', () => {
  const props = createProps((content) => content, {
    options: { mode: TextMode.HTML, content: '<p>Panel content</p>' },
    data: createData([toDataFrame({ fields: [] })]),
  });
  const { rerender } = render(<TextNGPanel {...props} />);
  expect(mount.mock.calls[0][0].html).toBe('<p>Panel content</p>');
  expect(mount.mock.calls[0][0].policy).toContain("default-src 'none'");

  mount.mockClear();
  rerender(<TextNGPanel {...props} data={createData([])} />);
  expect(screen.getByText('Panel content')).toBeVisible();
  expect(mount.mock.calls.at(-1)![0].policy).toBeUndefined();

  rerender(<TextNGPanel {...props} />);
  expect(mount.mock.calls.at(-1)![0].html).toBe('<p>Panel content</p>');
});

it('sanitizes protected HTML before handing it to the frame', () => {
  render(<TextSandbox html='<img src="https://example.com/image" onerror="alert(1)">' />);
  expect(mount.mock.calls[0][0].html).toBe('<img src="https://example.com/image">');
});

it('reports blocked origins to the dashboard from the panel view and stops when it unmounts', () => {
  const { unmount } = render(
    <TextSandbox html='<img src="https://report.example.com/a.png">' consent={{ panelId: 4, panelTitle: 'Users' }} />
  );
  act(() =>
    mount.mock.calls.at(-1)![0].onState({
      status: 'ready',
      resources: [
        {
          directive: 'img-src',
          origin: 'https://report.example.com',
          urls: [{ url: 'https://report.example.com/a.png', count: 3 }],
        },
        { directive: 'script-src' },
      ],
    })
  );
  expect(getBlockedSummary()).toEqual([
    {
      origin: 'https://report.example.com',
      host: 'report.example.com',
      panels: ['Users'],
      panelIds: [4],
      urls: [{ url: 'https://report.example.com/a.png', count: 3 }],
      count: 3,
    },
  ]);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  unmount();
  expect(getBlockedSummary()).toEqual([]);
});

it('does not report from previews, which have no panel title to attribute', () => {
  render(<TextSandbox html='<img src="https://preview.example.com/a.png">' />);
  act(() =>
    mount.mock.calls.at(-1)![0].onState({
      status: 'ready',
      resources: [{ directive: 'img-src', origin: 'https://preview.example.com', urls: [] }],
    })
  );
  expect(getBlockedSummary()).toEqual([]);
});

it('loads origins the viewer allowed while keeping scripts blocked', () => {
  render(
    <TextSandbox html='<img src="https://allowed.example.com/a.png">' consent={{ panelId: 1, panelTitle: 'Users' }} />
  );
  expect(mount.mock.calls.at(-1)![0].policy).not.toContain('https://allowed.example.com');

  act(() => allowOrigins([{ origin: 'https://allowed.example.com', panelIds: [2] }], 'dashboard'));
  expect(mount.mock.calls.at(-1)![0].policy).not.toContain('https://allowed.example.com');
  act(() => allowOrigins([{ origin: 'https://allowed.example.com', panelIds: [1] }], 'dashboard'));
  const policy = mount.mock.calls.at(-1)![0].policy;
  expect(policy).toContain('img-src data: https://allowed.example.com');
  expect(policy).toContain('frame-src https://allowed.example.com');
  expect(policy).toContain("script-src 'none'");
});

it('silently tracks loading and runtime failures without a consumer', () => {
  render(<TextSandbox html="<p>Content</p>" />);
  for (const status of ['loading', 'error'] as const) {
    act(() => mount.mock.calls.at(-1)![0].onState({ status, resources: [] }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Content')).toBeVisible();
  }
});

it('reuses sanitization on height changes but sanitizes changed content and protection mode', () => {
  const sanitize = jest.spyOn(textUtil, 'sanitizeTextPanelContent');
  const html = '<img src="/image.png" onerror="alert(1)">';
  try {
    const { rerender } = render(<TextSandbox html={html} minHeight={100} />);
    expect(sanitize).toHaveBeenCalledTimes(1);
    expect(mount.mock.calls.at(-1)![0].html).toBe('<img src="/image.png">');
    rerender(<TextSandbox html={html} minHeight={200} />);
    expect(sanitize).toHaveBeenCalledTimes(1);
    expect(mount.mock.calls.at(-1)![0].minHeight).toBe(200);
    rerender(<TextSandbox html={html} hasData={false} minHeight={200} />);
    expect(mount.mock.calls.at(-1)![0].html).toBe(html);
    rerender(<TextSandbox html={html} hasData minHeight={200} />);
    expect(sanitize).toHaveBeenCalledTimes(2);
    expect(mount.mock.calls.at(-1)![0].html).toBe('<img src="/image.png">');
    rerender(<TextSandbox html='<p onclick="alert(1)">Updated</p>' minHeight={200} />);
    expect(sanitize).toHaveBeenCalledTimes(3);
    expect(mount.mock.calls.at(-1)![0].html).toBe('<p>Updated</p>');
  } finally {
    sanitize.mockRestore();
  }
});

it('does not rerender unchanged frame content when panel width changes', () => {
  const props = createProps((content) => content, {
    options: { mode: TextMode.HTML, content: '<p>Stable content</p>' },
  });
  const { rerender } = render(<TextNGPanel {...props} />);
  expect(screen.getByText('Stable content')).toBeVisible();
  mount.mockClear();
  rerender(<TextNGPanel {...props} width={400} />);
  rerender(<TextNGPanel {...props} width={600} />);
  expect(mount).not.toHaveBeenCalled();
  rerender(<TextNGPanel {...props} width={600} options={{ ...props.options, content: '<p>Updated content</p>' }} />);
  expect(screen.getByText('Updated content')).toBeVisible();
  expect(mount.mock.calls.at(-1)![0].html).toBe('<p>Updated content</p>');
});

it('retains frame height while suspended and restores the latest content on return', () => {
  jest.useFakeTimers();
  let callback: IntersectionObserverCallback;
  let target: Element;
  const observer = jest.spyOn(window, 'IntersectionObserver').mockImplementation((notify) => {
    callback = notify;
    return {
      observe: (element) => {
        target = element;
      },
      unobserve: jest.fn(),
      disconnect: jest.fn(),
      root: null,
      rootMargin: '1000px',
      scrollMargin: '1000px',
      thresholds: [0],
      takeRecords: () => [],
    };
  });
  const visibility = (isIntersecting: boolean) =>
    act(() => callback([{ target, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
  try {
    const view = render(<TextSandbox html="<p>Initial</p>" deferOffscreen minHeight={100} />);
    expect(mount).not.toHaveBeenCalled();
    visibility(true);
    act(() => jest.advanceTimersByTime(16));
    expect(screen.getByText('Initial')).toBeInTheDocument();
    act(() => mount.mock.calls.at(-1)![0].onHeight(240, 230));
    visibility(false);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.queryByText('Initial')).not.toBeInTheDocument();
    expect(target!).toHaveStyle({ minHeight: '240px' });
    view.rerender(<TextSandbox html="<p>Latest</p>" deferOffscreen minHeight={100} />);
    visibility(true);
    act(() => jest.advanceTimersByTime(16));
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(target!).not.toHaveStyle({ minHeight: '240px' });
    view.unmount();
  } finally {
    observer.mockRestore();
    jest.useRealTimers();
  }
});

it.each([
  '<iframe title="Embedded" src="https://example.com"></iframe>',
  '<video controls></video>',
  '<input value="State">',
  '<details open><summary>State</summary></details>',
  '<div contenteditable="true">State</div>',
])('keeps stateful content mounted despite opting into visibility management: %s', (html) => {
  const observer = jest.spyOn(window, 'IntersectionObserver');
  const { unmount } = render(<TextSandbox html={html} hasData={false} deferOffscreen />);
  expect(mount).toHaveBeenCalled();
  expect(observer).not.toHaveBeenCalled();
  unmount();
  observer.mockRestore();
});

it.each([
  { name: 'dashboard', app: CoreApp.Dashboard, deferred: true },
  { name: 'panel viewer', app: CoreApp.PanelViewer, deferred: false },
  { name: 'fit content', app: CoreApp.Dashboard, fitContent: true, deferred: false },
  { name: 'image capture', app: CoreApp.Dashboard, capture: true, deferred: false },
  { name: 'unsanitized HTML', app: CoreApp.Dashboard, unsafe: true, deferred: false },
])('uses visibility management only where supported: $name', ({ app, fitContent, capture, unsafe, deferred }) => {
  jest.useFakeTimers();
  const previous = config.disableSanitizeHtml;
  config.disableSanitizeHtml = Boolean(unsafe);
  if (capture) {
    window.__grafanaImageRendererMessageChannel = jest.fn();
  }
  try {
    const view = renderPanel(
      createProps((value) => value, { fitContent, options: { content: 'Visible content' } }),
      app
    );
    if (deferred) {
      expect(mount).not.toHaveBeenCalled();
      act(() => jest.advanceTimersByTime(16));
    }
    expect(screen.getByText('Visible content')).toBeInTheDocument();
    view.unmount();
  } finally {
    config.disableSanitizeHtml = previous;
    delete window.__grafanaImageRendererMessageChannel;
    jest.useRealTimers();
  }
});

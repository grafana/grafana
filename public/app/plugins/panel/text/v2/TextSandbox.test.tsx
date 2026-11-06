import { act, render, screen } from '@testing-library/react';

import { toDataFrame } from '@grafana/data';
import { allowOrigins, getBlockedSummary } from 'app/features/dashboard-scene/scene/sandbox-consent/sandboxConsent';

import { TextMode } from '../panelcfg.gen';

import { SandboxFrame } from './SandboxFrame';
import { TextNGHtmlView } from './TextNGHtmlView';
import { TextNGPanel } from './TextNGPanel';
import { TextSandbox } from './TextSandbox';
import { createData, createProps } from './test-utils';

jest.mock('./SandboxFrame');

const mount = jest.mocked(SandboxFrame);

beforeEach(() => mount.mockClear());

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

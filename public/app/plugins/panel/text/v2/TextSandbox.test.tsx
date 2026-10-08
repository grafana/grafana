import { act, render, screen } from '@testing-library/react';

import { toDataFrame } from '@grafana/data';

import { TextMode } from '../panelcfg.gen';

import { SandboxFrame } from './SandboxFrame';
import { TextNGHtmlView } from './TextNGHtmlView';
import { TextNGPanel } from './TextNGPanel';
import { TextSandbox, type TextSandboxReport } from './TextSandbox';
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

it('silently reports resources and exposes origin remediation without panel UI', () => {
  const onStateChange = jest.fn<void, [TextSandboxReport | undefined]>();
  render(<TextSandbox html='<img src="https://example.com/image">' onStateChange={onStateChange} />);
  act(() =>
    mount.mock.calls[0][0].onState({
      status: 'ready',
      resources: [{ directive: 'img-src', origin: 'https://example.com' }],
    })
  );
  expect(screen.queryByText('https://example.com')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  const report = onStateChange.mock.calls.at(-1)![0]!;
  expect(report.canAllow).toBe(true);
  act(() => report.allow());
  expect(mount.mock.calls.at(-1)![0].policy).toContain('img-src data: https://example.com');
  expect(mount.mock.calls.at(-1)![0].policy).toContain('frame-src https://example.com');
  expect(mount.mock.calls.at(-1)![0].policy).toContain("script-src 'none'");

  act(() =>
    mount.mock.calls.at(-1)![0].onState({
      status: 'ready',
      resources: [{ directive: 'frame-src', origin: 'https://second.example.com' }],
    })
  );
  expect(onStateChange.mock.calls.at(-1)![0]!.state.resources).toEqual([
    { directive: 'frame-src', origin: 'https://second.example.com' },
  ]);
  expect(onStateChange.mock.calls.at(-1)![0]!.canAllow).toBe(true);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('does not permit remediation for restrictions the panel cannot relax', () => {
  const onStateChange = jest.fn<void, [TextSandboxReport | undefined]>();
  render(<TextSandbox html="<p>Content</p>" onStateChange={onStateChange} />);
  act(() => mount.mock.calls[0][0].onState({ status: 'ready', resources: [{ directive: 'script-src' }] }));
  const report = onStateChange.mock.calls.at(-1)![0]!;
  expect(report.canAllow).toBe(false);
  const policy = mount.mock.calls.at(-1)![0].policy;
  act(() => report.allow());
  expect(mount.mock.calls.at(-1)![0].policy).toBe(policy);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it.each(['refresh', 'unmount', 'new snapshot'] as const)('invalidates remediation after %s', (action) => {
  const onStateChange = jest.fn<void, [TextSandboxReport | undefined]>();
  const { rerender, unmount } = render(<TextSandbox html="<p>Content</p>" onStateChange={onStateChange} />);
  act(() =>
    mount.mock.calls.at(-1)![0].onState({
      status: 'ready',
      resources: [{ directive: 'img-src', origin: 'https://example.com' }],
    })
  );
  const report = onStateChange.mock.calls.at(-1)![0]!;
  if (action === 'refresh') {
    rerender(<TextSandbox html="<p>Refreshed</p>" onStateChange={onStateChange} />);
    expect(onStateChange).toHaveBeenCalledWith(undefined);
  } else if (action === 'unmount') {
    unmount();
    expect(onStateChange).toHaveBeenLastCalledWith(undefined);
  } else {
    act(() => mount.mock.calls.at(-1)![0].onState({ status: 'error', resources: [] }));
  }
  const count = mount.mock.calls.length;
  act(() => report.allow());
  expect(mount.mock.calls).toHaveLength(count);
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

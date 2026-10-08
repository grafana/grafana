import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { toDataFrame } from '@grafana/data';

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

it('recreates content with origin consent and prompts again for a different origin', async () => {
  render(<TextSandbox html='<img src="https://example.com/image">' />);
  act(() =>
    mount.mock.calls[0][0].onState({
      status: 'blocked',
      resources: [{ directive: 'img-src', origin: 'https://example.com' }],
    })
  );
  expect(screen.getByText('https://example.com')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Allow' }));
  expect(mount.mock.calls.at(-1)![0].policy).toContain('img-src data: https://example.com');
  expect(mount.mock.calls.at(-1)![0].policy).toContain('frame-src https://example.com');
  expect(mount.mock.calls.at(-1)![0].policy).toContain("script-src 'none'");

  act(() =>
    mount.mock.calls.at(-1)![0].onState({
      status: 'blocked',
      resources: [{ directive: 'frame-src', origin: 'https://second.example.com' }],
    })
  );
  expect(screen.getByText('https://second.example.com')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Allow' })).toBeEnabled();
});

it('does not offer consent for restrictions the panel cannot relax', () => {
  render(<TextSandbox html="<p>Content</p>" />);
  act(() => mount.mock.calls[0][0].onState({ status: 'blocked', resources: [{ directive: 'script-src' }] }));
  expect(screen.getByText('These resources cannot be allowed by the text panel.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Allow' })).not.toBeInTheDocument();
});

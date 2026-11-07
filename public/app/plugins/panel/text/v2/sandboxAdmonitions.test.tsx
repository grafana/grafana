import { act, screen, within } from '@testing-library/react';

import { createTheme, renderMarkdown } from '@grafana/data';

import { renderAdmonitions } from './sandboxAdmonitions';
import { TEXT_FRAME_PROTOCOL, type RenderCommand } from './sandboxProtocol';

const titles = { note: 'Note', tip: 'Tip', important: 'Important', warning: 'Warning', caution: 'Caution' };

function command(admonitions: RenderCommand['admonitions']): RenderCommand {
  return {
    protocol: TEXT_FRAME_PROTOCOL,
    channel: 'test-channel',
    type: 'render',
    html: '',
    globalCss: '',
    diagramError: 'Diagram failed',
    admonitions,
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

it('renders a Markdown admonition with its theme and bundled icon, then restores the fallback on disposal', () => {
  const container = document.createElement('div');
  container.innerHTML = renderMarkdown('> [!NOTE]\n> Read [docs](https://grafana.com).');
  document.body.append(container);

  let dispose = () => {};
  act(() => {
    dispose = renderAdmonitions(command({ theme: JSON.stringify(createTheme()), titles }), container);
  });

  const alert = screen.getByRole('status', { name: 'Note' });
  expect(within(alert).getByRole('link', { name: 'docs' })).toHaveAttribute('href', 'https://grafana.com');
  expect(alert.querySelector('svg')).toBeInTheDocument();
  expect(container.querySelector('blockquote')).toBeNull();

  act(() => dispose());
  expect(screen.queryByRole('status', { name: 'Note' })).not.toBeInTheDocument();
  expect(container.querySelector('blockquote.grafana-markdown-alert-note')).toHaveTextContent('Read docs.');
});

it('does not mount an Alert runtime without admonition configuration', () => {
  const container = document.createElement('div');
  document.body.append(container);

  const dispose = renderAdmonitions(command(undefined), container);

  expect(document.body).toContainElement(container);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  dispose();
});

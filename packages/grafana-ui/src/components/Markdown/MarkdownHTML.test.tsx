import { render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';

import { renderMarkdown } from '@grafana/data';

import { MarkdownHTML } from './MarkdownHTML';

it.each([
  ['NOTE', 'Note', 'status'],
  ['TIP', 'Tip', 'status'],
  ['IMPORTANT', 'Important', 'status'],
  ['WARNING', 'Warning', 'alert'],
  ['CAUTION', 'Caution', 'alert'],
])('renders %s with Alert accessibility and formatted content', (kind, title, role) => {
  render(<MarkdownHTML html={renderMarkdown(`> [!${kind}]\n> **Read** [docs](https://grafana.com).`)} />);
  const alert = screen.getByRole(role, { name: title });
  expect(within(alert).getByRole('link', { name: 'docs' })).toHaveAttribute('href', 'https://grafana.com');
  expect(within(alert).getByText('Read').tagName).toBe('STRONG');
  expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
});

it('replaces, removes and unmounts alerts without stale content, including StrictMode', () => {
  const { rerender, unmount } = render(
    <StrictMode>
      <MarkdownHTML html={renderMarkdown('> [!NOTE]\n> Old')} />
    </StrictMode>
  );
  expect(screen.getByRole('status', { name: 'Note' })).toHaveTextContent('Old');
  rerender(
    <StrictMode>
      <MarkdownHTML html={renderMarkdown('> [!WARNING]\n> New')} />
    </StrictMode>
  );
  expect(screen.queryByText('Old')).not.toBeInTheDocument();
  expect(screen.getByRole('alert', { name: 'Warning' })).toHaveTextContent('New');
  rerender(
    <StrictMode>
      <MarkdownHTML html={renderMarkdown('Ordinary text')} />
    </StrictMode>
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Ordinary text')).toBeInTheDocument();
  unmount();
});

it('renders nested alerts while retaining surrounding markup', () => {
  render(<MarkdownHTML html={renderMarkdown('Before\n\n> [!NOTE]\n> Outer\n>\n> > [!TIP]\n> > Inner\n\nAfter')} />);
  expect(within(screen.getByRole('status', { name: 'Note' })).getByRole('status', { name: 'Tip' })).toHaveTextContent(
    'Inner'
  );
  expect(screen.getByText('Before')).toBeInTheDocument();
  expect(screen.getByText('After')).toBeInTheDocument();
});

it('underlines links in Alert text so they remain distinguishable from surrounding text', () => {
  render(<MarkdownHTML html={renderMarkdown('> [!NOTE]\n> Read [docs](https://grafana.com).')} />);

  expect(within(screen.getByRole('status', { name: 'Note' })).getByRole('link', { name: 'docs' })).toHaveStyle({
    textDecoration: 'underline',
  });
});

it.each([false, true])('sanitizes raw HTML before rendering (admonition: %s)', (admonition) => {
  const body =
    '<p>Readable content</p><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">Unsafe</a><script>alert(1)</script>';
  const html = admonition
    ? `<blockquote class="grafana-markdown-alert-note"><p>Note</p><div class="grafana-markdown-alert-body">${body}</div></blockquote>`
    : body;
  const { container } = render(<MarkdownHTML html={html} />);
  expect(screen.getByText('Readable content')).toBeInTheDocument();
  if (admonition) {
    expect(screen.getByRole('status', { name: 'Note' })).toHaveTextContent('Readable content');
  }
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('[onerror]')).toBeNull();
  expect(screen.getByText('Unsafe')).not.toHaveAttribute('href', 'javascript:alert(1)');
});

it('preserves Markdown task checkboxes and restricts embedded iframes', () => {
  const { container } = render(
    <MarkdownHTML
      html={renderMarkdown('- [x] Done\n\n<iframe src="https://grafana.com" sandbox="allow-scripts"></iframe>', {
        noSanitize: true,
      })}
    />
  );
  expect(screen.getByRole('checkbox')).toBeChecked();
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(container.querySelector('iframe')).toHaveAttribute('src', 'https://grafana.com');
  expect(container.querySelector('iframe')).toHaveAttribute('sandbox', '');
});

it('preserves relative links and data attributes with the HTML policy while stripping executable markup', () => {
  const { container } = render(
    <MarkdownHTML
      sanitization="html"
      html='<a href="dashboard.json" data-path="dashboard.json" onclick="alert(1)">Dashboard</a><iframe src="https://grafana.com"></iframe><input type="checkbox"><script>alert(1)</script>'
    />
  );
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', 'dashboard.json');
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('data-path', 'dashboard.json');
  expect(container.querySelector('[onclick], iframe, input, script')).toBeNull();
});

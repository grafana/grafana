import { render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';

import { renderMarkdown, textUtil } from '@grafana/data';

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

it('does not turn sanitized user HTML into executable content, even with forged markers', () => {
  const html = textUtil.sanitizeTextPanelContent(
    '<blockquote class="grafana-markdown-alert-note"><p>Note</p><div class="grafana-markdown-alert-body"><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">Unsafe</a><script>alert(1)</script></div></blockquote>'
  );
  const { container } = render(<MarkdownHTML html={html} />);
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('[onerror]')).toBeNull();
  expect(screen.getByText('Unsafe')).not.toHaveAttribute('href', 'javascript:alert(1)');
});

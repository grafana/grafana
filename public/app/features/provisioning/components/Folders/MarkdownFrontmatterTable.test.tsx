import { render, screen, within } from 'test/test-utils';

import { type YamlNode } from '../../utils/markdownFrontmatter';

import { MarkdownFrontmatterTable } from './MarkdownFrontmatterTable';

describe('MarkdownFrontmatterTable', () => {
  it('renders one row per key, with the key as the row header, scalars as text and an empty value as an empty cell', () => {
    render(<MarkdownFrontmatterTable data={{ title: 'Team A', version: '1.10', editable: 'false', owner: null }} />);

    expect(screen.getByRole('table', { name: 'Document metadata' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'title' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Team A' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '1.10' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'false' })).toBeInTheDocument();

    const ownerRow = screen.getByRole('rowheader', { name: 'owner' }).closest('tr')!;
    expect(within(ownerRow).getByRole('cell')).toBeEmptyDOMElement();
  });

  it('renders http(s) values as external links and every other string as plain text', () => {
    render(
      <MarkdownFrontmatterTable
        data={{
          sourceUrl: 'https://example.com/docs',
          note: 'see https://example.com',
          unsafe: 'javascript:alert(1)',
        }}
      />
    );

    const link = screen.getByRole('link', { name: /https:\/\/example\.com\/docs/ });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('cell', { name: 'see https://example.com' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'javascript:alert(1)' })).toBeInTheDocument();
  });

  it('lays out a list as one row of cells', () => {
    render(<MarkdownFrontmatterTable data={{ tags: ['as-code', 'markdown'] }} />);

    const row = screen.getByRole('rowheader', { name: 'tags' }).closest('tr')!;
    const inner = row.querySelector('table tr')!;
    expect(Array.from(inner.querySelectorAll('td')).map((cell) => cell.textContent)).toEqual(['as-code', 'markdown']);
  });

  it('renders a nested mapping as nested key/value rows', () => {
    render(<MarkdownFrontmatterTable data={{ owner: { team: 'platform', slack: '#platform' } }} />);

    expect(screen.getByRole('rowheader', { name: 'team' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'platform' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'slack' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '#platform' })).toBeInTheDocument();
  });

  it('shows containers nested more than two levels deep as a placeholder', () => {
    render(<MarkdownFrontmatterTable data={{ a: { b: { c: ['1', '2'], d: { e: '1' } } } }} />);

    expect(screen.getByRole('rowheader', { name: 'c' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '[…]' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'd' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '{…}' })).toBeInTheDocument();
  });

  it('shows empty lists and mappings as [] and {}', () => {
    render(<MarkdownFrontmatterTable data={{ tags: [], meta: {} }} />);

    expect(screen.getByRole('cell', { name: '[]' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '{}' })).toBeInTheDocument();
  });

  it('cuts a self-referencing list off at the nesting limit instead of serializing it', () => {
    // js-yaml resolves `loop: &x [*x]` to an array that contains itself.
    const loop: YamlNode[] = [];
    loop.push(loop);

    render(<MarkdownFrontmatterTable data={{ loop }} />);

    const row = screen.getByRole('rowheader', { name: 'loop' }).closest('tr')!;
    // Expanded as a list twice (the nesting limit), then a placeholder.
    expect(row.querySelectorAll('table')).toHaveLength(2);
    expect(row).toHaveTextContent(/^loop\[…\]$/);
  });

  it('renders nothing for an empty mapping', () => {
    const { container } = render(<MarkdownFrontmatterTable data={{}} />);

    expect(container).toBeEmptyDOMElement();
  });
});

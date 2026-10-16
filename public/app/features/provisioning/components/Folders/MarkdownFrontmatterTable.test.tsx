import { render, screen } from 'test/test-utils';

import { MarkdownFrontmatterTable } from './MarkdownFrontmatterTable';

describe('MarkdownFrontmatterTable', () => {
  it('renders one row per key, with the key as the row header and scalars as text', () => {
    render(<MarkdownFrontmatterTable data={{ title: 'Team A', weight: 10, editable: false, owner: null }} />);

    expect(screen.getByRole('table', { name: 'Document metadata' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'title' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Team A' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '10' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'false' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'null' })).toBeInTheDocument();
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
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('cell', { name: 'see https://example.com' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'javascript:alert(1)' })).toBeInTheDocument();
  });

  it('keeps the line breaks of a multi-line value', () => {
    render(<MarkdownFrontmatterTable data={{ description: 'line one\nline two\n' }} />);

    // The accessible name keeps the break only because the cell's white-space does.
    expect(screen.getByRole('cell', { name: 'line one\nline two' })).toHaveStyle({ whiteSpace: 'pre-line' });
  });

  it('lays out a list as one row of cells', () => {
    render(<MarkdownFrontmatterTable data={{ tags: ['as-code', 'markdown'] }} />);

    const row = screen.getByRole('rowheader', { name: 'tags' }).closest('tr')!;
    const inner = row.querySelector('table tr')!;
    expect(Array.from(inner.querySelectorAll('td')).map((cell) => cell.textContent)).toEqual(['as-code', 'markdown']);
  });

  it('keeps list items whole and lets a long row scroll instead of wrapping', () => {
    render(<MarkdownFrontmatterTable data={{ tags: ['as-code', 'markdown'] }} />);

    expect(screen.getByRole('cell', { name: 'as-code' })).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(screen.getByRole('table', { name: 'Document metadata' }).parentElement).toHaveStyle({ overflowX: 'auto' });
  });

  it('renders a nested mapping as nested key/value rows', () => {
    render(<MarkdownFrontmatterTable data={{ owner: { team: 'platform', slack: '#platform' } }} />);

    expect(screen.getByRole('rowheader', { name: 'team' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'platform' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'slack' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '#platform' })).toBeInTheDocument();
  });

  it('shows containers nested more than two levels deep as JSON', () => {
    render(<MarkdownFrontmatterTable data={{ a: { b: { c: [1, 2] } } }} />);

    expect(screen.getByRole('rowheader', { name: 'c' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '[1,2]' })).toBeInTheDocument();
  });

  it('shows empty lists and mappings as JSON', () => {
    render(<MarkdownFrontmatterTable data={{ tags: [], meta: {} }} />);

    expect(screen.getByRole('cell', { name: '[]' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '{}' })).toBeInTheDocument();
  });

  it('renders nothing for an empty mapping', () => {
    const { container } = render(<MarkdownFrontmatterTable data={{}} />);

    expect(container).toBeEmptyDOMElement();
  });
});

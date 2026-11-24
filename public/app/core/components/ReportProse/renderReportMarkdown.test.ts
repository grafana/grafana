import { renderReportMarkdown } from './renderReportMarkdown';

describe('renderReportMarkdown', () => {
  it('renders paragraphs, emphasis, lists, and code spans', () => {
    const html = renderReportMarkdown('One *two* **three** `four`\n\n- a\n- b\n\n1. c');

    expect(html).toContain('<em>two</em>');
    expect(html).toContain('<strong>three</strong>');
    expect(html).toContain('<code>four</code>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
  });

  it('shows raw HTML as text instead of rendering it', () => {
    const html = renderReportMarkdown(
      'Before <script>alert(1)</script> <iframe src="https://example.com"></iframe> after'
    );

    expect(html).not.toMatch(/<script|<iframe/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('never loads remote images', () => {
    const html = renderReportMarkdown('![chart](https://example.com/chart.png)');

    expect(html).not.toContain('<img');
    expect(html).not.toContain('example.com');
    expect(html).toContain('chart');
  });

  it('keeps safe links and drops script or protocol-relative ones', () => {
    const html = renderReportMarkdown(
      '[runbook](https://grafana.com/docs) [local](/d/abc) [bad](javascript:alert(1)) [data](data:text/html,x) [rel](//evil.example)'
    );

    expect(html).toContain('href="https://grafana.com/docs"');
    expect(html).toContain('href="/d/abc"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toMatch(/javascript:|data:text|\/\/evil/);
    expect(html).toContain('bad');
  });

  it('demotes headings so they cannot compete with the section heading', () => {
    const html = renderReportMarkdown('# Big claim');

    expect(html).not.toMatch(/<h\d/);
    expect(html).toContain('<strong>Big claim</strong>');
  });

  it('does not interpolate variables', () => {
    expect(renderReportMarkdown('Cluster $cluster and ${env}')).toContain('Cluster $cluster and ${env}');
  });

  it('returns nothing for blank input', () => {
    expect(renderReportMarkdown('  \n ')).toBe('');
    expect(renderReportMarkdown(undefined)).toBe('');
  });
});

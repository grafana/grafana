import { render, screen } from 'test/test-utils';

import { AlertEnrichments } from './AlertEnrichments';

describe('AlertEnrichments', () => {
  it('should render nothing when enrichments has no items', () => {
    const { container } = render(<AlertEnrichments enrichments={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render nothing when items is an empty array', () => {
    const { container } = render(<AlertEnrichments enrichments={{ items: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render nothing when items contains no valid enrichment objects', () => {
    const { container } = render(<AlertEnrichments enrichments={{ items: ['invalid', 42, null] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render enrichments header when valid items exist', () => {
    const enrichments = {
      items: [{ type: 'logs', lines: ['log line 1'] }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    expect(screen.getByText('Enrichments:')).toBeInTheDocument();
  });

  it('should render log lines for logs enrichment type', () => {
    const enrichments = {
      items: [{ type: 'logs', lines: ['first log line', 'second log line'] }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    expect(screen.getByText('first log line')).toBeInTheDocument();
    expect(screen.getByText('second log line')).toBeInTheDocument();
  });

  it('should render "No log lines" when logs enrichment has no lines', () => {
    const enrichments = {
      items: [{ type: 'logs' }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    expect(screen.getByText('No log lines')).toBeInTheDocument();
  });

  it('should render "No log lines" when lines array is empty', () => {
    const enrichments = {
      items: [{ type: 'logs', lines: [] }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    expect(screen.getByText('No log lines')).toBeInTheDocument();
  });

  it('should render explore link when exploreLink is provided', () => {
    const enrichments = {
      items: [{ type: 'logs', exploreLink: '/explore?orgId=1', lines: [] }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    const link = screen.getByRole('link', { name: /View in Explore/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should not render explore link when exploreLink is not provided', () => {
    const enrichments = {
      items: [{ type: 'logs', lines: ['a log'] }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    expect(screen.queryByRole('link', { name: /View in Explore/i })).not.toBeInTheDocument();
  });

  it('should render a badge fallback for unknown enrichment types', () => {
    const enrichments = {
      items: [{ type: 'metrics' }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    expect(screen.getByText('Enrichments:')).toBeInTheDocument();
    expect(screen.getByText('metrics')).toBeInTheDocument();
  });

  it('should skip invalid items and render valid ones', () => {
    const enrichments = {
      items: [null, { type: 'logs', lines: ['valid line'] }, 'invalid', { type: 'logs', lines: ['another line'] }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    expect(screen.getByText('valid line')).toBeInTheDocument();
    expect(screen.getByText('another line')).toBeInTheDocument();
  });

  it('should not render explore link for a javascript: URL', () => {
    const enrichments = {
      items: [{ type: 'logs', exploreLink: 'javascript:alert(1)', lines: [] }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    expect(screen.queryByRole('link', { name: /View in Explore/i })).not.toBeInTheDocument();
  });

  it('should not render explore link for a data: URL', () => {
    const enrichments = {
      items: [{ type: 'logs', exploreLink: 'data:text/html,<script>alert(1)</script>', lines: [] }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    expect(screen.queryByRole('link', { name: /View in Explore/i })).not.toBeInTheDocument();
  });

  it('should not render explore link for a protocol-relative URL', () => {
    const enrichments = {
      items: [{ type: 'logs', exploreLink: '//evil.com/path', lines: [] }],
    };
    render(<AlertEnrichments enrichments={enrichments} />);
    expect(screen.queryByRole('link', { name: /View in Explore/i })).not.toBeInTheDocument();
  });

  it('should discard items with non-string lines values', () => {
    const enrichments = {
      items: [{ type: 'logs', lines: [123, null] }],
    };
    const { container } = render(<AlertEnrichments enrichments={enrichments} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should discard items with non-string exploreLink', () => {
    const enrichments = {
      items: [{ type: 'logs', exploreLink: 42, lines: ['a line'] }],
    };
    const { container } = render(<AlertEnrichments enrichments={enrichments} />);
    expect(container).toBeEmptyDOMElement();
  });
});

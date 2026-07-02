import { render, screen } from '@testing-library/react';

import { type QueryFlowDiagnostic } from '../diagnostics/types';

import { QueryFlowAnnotations } from './QueryFlowAnnotations';

const positions = { 'function:0-10': { x: 100, y: 200 } };

describe('QueryFlowAnnotations', () => {
  it('renders a callout with its message and suggestion for a positioned node', () => {
    const diagnostics: QueryFlowDiagnostic[] = [
      {
        id: 'prom-range-vector:function:0-10',
        nodeId: 'function:0-10',
        severity: 'error',
        message: 'rate expects a metric with a time range.',
        suggestion: 'rate(metric[5m])',
      },
    ];

    render(<QueryFlowAnnotations diagnostics={diagnostics} positions={positions} />);

    expect(screen.getByTestId('query-flow-annotation')).toBeInTheDocument();
    expect(screen.getByText('rate expects a metric with a time range.')).toBeInTheDocument();
    expect(screen.getByText('rate(metric[5m])')).toBeInTheDocument();
  });

  it('renders a docs link when the diagnostic carries a docsHref', () => {
    const diagnostics: QueryFlowDiagnostic[] = [
      {
        id: 'prom-range-vector:function:0-10',
        nodeId: 'function:0-10',
        severity: 'error',
        message: 'rate expects a metric with a time range.',
        docsHref: 'https://prometheus.io/docs/prometheus/latest/querying/functions/#rate',
      },
    ];

    render(<QueryFlowAnnotations diagnostics={diagnostics} positions={positions} />);

    const link = screen.getByTestId('query-flow-annotation-docs');
    expect(link).toHaveAttribute('href', 'https://prometheus.io/docs/prometheus/latest/querying/functions/#rate');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does not render a docs link when the diagnostic has none', () => {
    const diagnostics: QueryFlowDiagnostic[] = [
      { id: 'x', nodeId: 'function:0-10', severity: 'tip', message: 'no docs for this one' },
    ];

    render(<QueryFlowAnnotations diagnostics={diagnostics} positions={positions} />);

    expect(screen.queryByTestId('query-flow-annotation-docs')).not.toBeInTheDocument();
  });

  it('skips diagnostics whose node has no known position', () => {
    const diagnostics: QueryFlowDiagnostic[] = [{ id: 'x', nodeId: 'missing', severity: 'tip', message: 'hidden' }];

    render(<QueryFlowAnnotations diagnostics={diagnostics} positions={positions} />);

    expect(screen.queryByTestId('query-flow-annotation')).not.toBeInTheDocument();
  });
});

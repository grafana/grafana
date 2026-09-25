import { render, screen } from 'test/test-utils';

import { EvaluationMatches } from './EvaluationMatches';

describe('EvaluationMatches', () => {
  it('renders the RefID, metric, labels, and value', () => {
    render(
      <EvaluationMatches
        matches={[
          {
            refId: 'B0',
            metric: 'http_requests_total',
            labels: { pod: 'pod-1' },
            value: '42',
          },
        ]}
      />
    );

    expect(screen.getByText('B0: http_requests_total')).toBeInTheDocument();
    expect(screen.getByText('pod=pod-1')).toBeInTheDocument();
    expect(screen.getByText('value: 42')).toBeInTheDocument();
  });

  it('renders labels from legacy tags', () => {
    render(<EvaluationMatches matches={[{ metric: 'legacy-series', tags: { host: 'server-1' }, value: 1 }]} />);

    expect(screen.getByText('legacy-series')).toBeInTheDocument();
    expect(screen.getByText('host=server-1')).toBeInTheDocument();
    expect(screen.getByText('value: 1')).toBeInTheDocument();
  });

  it('does not render an empty match row', () => {
    render(<EvaluationMatches matches={[]} />);

    expect(screen.queryByText(/value:/)).not.toBeInTheDocument();
  });
});

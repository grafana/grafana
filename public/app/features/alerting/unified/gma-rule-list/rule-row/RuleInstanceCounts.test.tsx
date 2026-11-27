import { render, screen } from 'test/test-utils';

import { type AlertRuleSearchHit } from '../alert-rules/alertRuleSearchHit';

import { RuleInstanceCounts } from './RuleInstanceCounts';

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return { uid: 'rule-1', title: 'CPU high', ...overrides };
}

describe('RuleInstanceCounts', () => {
  it('renders nothing when all totals fields are absent', () => {
    const { container } = render(<RuleInstanceCounts searchHit={baseHit()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows only states with a non-zero count', () => {
    render(<RuleInstanceCounts searchHit={baseHit({ totalsFiring: 2, totalsPending: 1, totalsHealthy: 5 })} />);

    expect(screen.getByText('2 firing')).toBeInTheDocument();
    expect(screen.getByText('1 pending')).toBeInTheDocument();
    expect(screen.getByText('5 normal')).toBeInTheDocument();
    expect(screen.queryByText(/recovering/)).not.toBeInTheDocument();
    expect(screen.queryByText(/no data/)).not.toBeInTheDocument();
    expect(screen.queryByText(/error/)).not.toBeInTheDocument();
  });

  it('omits a state when its count is 0', () => {
    render(<RuleInstanceCounts searchHit={baseHit({ totalsFiring: 0, totalsHealthy: 3 })} />);

    expect(screen.queryByText(/firing/)).not.toBeInTheDocument();
    expect(screen.getByText('3 normal')).toBeInTheDocument();
  });

  it('shows all six states when all are non-zero', () => {
    render(
      <RuleInstanceCounts
        searchHit={baseHit({
          totalsFiring: 1,
          totalsPending: 2,
          totalsHealthy: 3,
          totalsRecovering: 4,
          totalsNoData: 5,
          totalsError: 6,
        })}
      />
    );

    expect(screen.getByText('1 firing')).toBeInTheDocument();
    expect(screen.getByText('2 pending')).toBeInTheDocument();
    expect(screen.getByText('3 normal')).toBeInTheDocument();
    expect(screen.getByText('4 recovering')).toBeInTheDocument();
    expect(screen.getByText('5 no data')).toBeInTheDocument();
    expect(screen.getByText('6 error')).toBeInTheDocument();
  });

  it('wraps the entire block in a single link to the instances tab', () => {
    render(<RuleInstanceCounts searchHit={baseHit({ totalsFiring: 2, totalsHealthy: 5 })} />);

    const link = screen.getByRole('link', { name: /instances/i });
    expect(link).toHaveAttribute('href', '/alerting/grafana/rule-1/view?tab=instances');
    expect(link).toHaveTextContent('2 firing');
    expect(link).toHaveTextContent('5 normal');
  });
});

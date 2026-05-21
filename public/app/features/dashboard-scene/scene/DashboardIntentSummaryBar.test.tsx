import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DashboardScene, type DashboardSceneState } from './DashboardScene';
import { DashboardIntentSummaryBar } from './DashboardIntentSummaryBar';

function buildDashboard(intent?: DashboardSceneState['intent']): DashboardScene {
  return new DashboardScene({
    title: 'Test',
    uid: 'dash-1',
    meta: {},
    intent,
  });
}

describe('DashboardIntentSummaryBar', () => {
  it('renders nothing when the dashboard has no intent block', () => {
    const dashboard = buildDashboard(undefined);
    const { container } = render(<DashboardIntentSummaryBar dashboard={dashboard} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when intent is present but empty', () => {
    // Defensive: an empty intent block should be treated the same as
    // no intent so we don't paint an "About this dashboard" header
    // with no content underneath.
    const dashboard = buildDashboard({});
    const { container } = render(<DashboardIntentSummaryBar dashboard={dashboard} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders purpose, owner, failure modes, and runbooks when populated', () => {
    const dashboard = buildDashboard({
      purpose: 'Track checkout p99 latency.',
      owner: '@checkout-team',
      failureModes: [
        { tag: 'deploy-regression', description: 'Elevated p99 after a deploy.' },
        { tag: 'db-slow' },
      ],
      runbooks: [{ title: 'Checkout runbook', url: 'https://wiki/checkout' }],
      provenance: {
        purpose: 'author-written',
        owner: 'author-written',
        failure_modes: 'assistant-unconfirmed',
        runbooks: 'author-written',
      },
    });

    render(<DashboardIntentSummaryBar dashboard={dashboard} />);

    expect(screen.getByTestId('dashboard-intent-summary-bar')).toBeInTheDocument();
    expect(screen.getByText('Track checkout p99 latency.')).toBeInTheDocument();
    expect(screen.getByText('@checkout-team')).toBeInTheDocument();
    expect(screen.getByText('deploy-regression')).toBeInTheDocument();
    expect(screen.getByText('db-slow')).toBeInTheDocument();
    const runbookLink = screen.getByRole('link', { name: /Checkout runbook/ });
    expect(runbookLink).toHaveAttribute('href', 'https://wiki/checkout');
    expect(runbookLink).toHaveAttribute('target', '_blank');
  });

  it('collapses the body when the user clicks the chevron, keeping the header visible', async () => {
    const dashboard = buildDashboard({
      purpose: 'Track checkout p99 latency.',
      owner: '@checkout-team',
    });
    render(<DashboardIntentSummaryBar dashboard={dashboard} />);

    // Visible by default.
    expect(screen.getByText('Track checkout p99 latency.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Collapse dashboard intent/i }));

    expect(screen.queryByText('Track checkout p99 latency.')).not.toBeInTheDocument();
    // Header (with owner chip) stays so the user can re-expand without scrolling.
    expect(screen.getByText('@checkout-team')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expand dashboard intent/i })).toBeInTheDocument();
  });

  it('renders only the runbooks section when intent has runbooks but no purpose/owner/failure-modes', () => {
    // Edge case: a "lightweight" intent that only links runbooks. The
    // bar must still render and surface the runbook, not noop.
    const dashboard = buildDashboard({
      runbooks: [{ title: 'On-call', url: 'https://wiki/oncall' }],
    });
    render(<DashboardIntentSummaryBar dashboard={dashboard} />);
    expect(screen.getByRole('link', { name: /On-call/ })).toHaveAttribute('href', 'https://wiki/oncall');
  });
});

import { render, screen } from 'test/test-utils';

import { type AlertRuleSearchHit } from '../alert-rules/alertRuleSearchHit';

import { RuleRouting } from './RuleRouting';

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return { uid: 'rule-1', title: 'CPU high', ...overrides };
}

describe('RuleRouting', () => {
  it('renders nothing when notificationType is absent', () => {
    const { container } = render(<RuleRouting searchHit={baseHit()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Delivered to {receiver}" with a contact-point link for SimplifiedRouting', () => {
    render(<RuleRouting searchHit={baseHit({ notificationType: 'SimplifiedRouting', receiver: 'pagerduty' })} />);

    expect(screen.getByText('Delivered to')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'pagerduty' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', expect.stringContaining('pagerduty'));
  });

  it('shows "Policy: {name}" for NamedRoutingTree with a named policy', () => {
    render(
      <RuleRouting searchHit={baseHit({ notificationType: 'NamedRoutingTree', routingTree: 'infra-critical' })} />
    );

    expect(screen.getByText('Policy: infra-critical')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows "Default policy" for NamedRoutingTree without a routing tree name', () => {
    render(<RuleRouting searchHit={baseHit({ notificationType: 'NamedRoutingTree' })} />);

    expect(screen.getByText('Default policy')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders nothing for SimplifiedRouting when receiver is absent', () => {
    const { container } = render(<RuleRouting searchHit={baseHit({ notificationType: 'SimplifiedRouting' })} />);
    expect(container).toBeEmptyDOMElement();
  });
});

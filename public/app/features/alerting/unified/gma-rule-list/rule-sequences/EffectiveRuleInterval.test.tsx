import { render, screen } from 'test/test-utils';

import { EffectiveRuleInterval } from './EffectiveRuleInterval';

describe('EffectiveRuleInterval', () => {
  it('shows the rule interval and no sequence pill when the rule is in no sequence', () => {
    render(<EffectiveRuleInterval sequence={null} ruleInterval="5m" />);

    expect(screen.getByRole('img', { name: 'Evaluated every 5m' })).toBeInTheDocument();
    expect(screen.queryByText(/Rule sequence/)).not.toBeInTheDocument();
  });

  it('shows the sequence pill with its interval instead of the rule interval on a member', () => {
    render(<EffectiveRuleInterval sequence={{ name: 'seq-1', interval: '2m' }} ruleInterval="5m" />);

    expect(screen.getByText('Rule sequence · 2m')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Evaluated every 5m' })).not.toBeInTheDocument();
  });

  it('shows the sequence pill without an interval when the sequence has none', () => {
    render(<EffectiveRuleInterval sequence={{ name: 'seq-1' }} ruleInterval="5m" />);

    expect(screen.getByText('Rule sequence')).toBeInTheDocument();
  });

  it('shows nothing while membership is unknown', () => {
    render(<EffectiveRuleInterval ruleInterval="5m" />);

    expect(screen.queryByRole('img', { name: /Evaluated every/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Rule sequence/)).not.toBeInTheDocument();
  });

  it('shows nothing for a rule in no sequence without an interval', () => {
    render(<EffectiveRuleInterval sequence={null} />);

    expect(screen.queryByRole('img', { name: /Evaluated every/ })).not.toBeInTheDocument();
  });
});

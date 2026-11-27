import { render, screen } from 'test/test-utils';

import { EffectiveRuleInterval } from './EffectiveRuleInterval';

describe('EffectiveRuleInterval', () => {
  it('shows the rule interval and no sequence pill when the rule is in no sequence', () => {
    render(<EffectiveRuleInterval sequence={null} ruleInterval="5m" onSequenceClick={jest.fn()} />);

    expect(screen.getByRole('img', { name: 'Evaluated every 5m' })).toBeInTheDocument();
    expect(screen.queryByText(/Rule sequence/)).not.toBeInTheDocument();
  });

  it('shows the sequence pill with its interval instead of the rule interval on a member', () => {
    render(
      <EffectiveRuleInterval
        sequence={{ uid: 'seq-1', interval: '2m' }}
        ruleInterval="5m"
        onSequenceClick={jest.fn()}
      />
    );

    expect(screen.getByText('Rule sequence · 2m')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Evaluated every 5m' })).not.toBeInTheDocument();
  });

  it.each([
    { name: 'membership is unknown', props: { ruleInterval: '5m' } },
    { name: 'the rule is in no sequence and has no interval', props: { sequence: null } },
  ])('renders nothing when $name', ({ props }) => {
    const { container } = render(<EffectiveRuleInterval {...props} onSequenceClick={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});

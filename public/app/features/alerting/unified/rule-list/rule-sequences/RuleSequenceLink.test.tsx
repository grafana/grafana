import { render, screen } from 'test/test-utils';
import { byText } from 'testing-library-selector';

import { ALERT_RULE_UID_1, RULE_SEQUENCE_UID_1 } from '../../mocks/server/handlers/k8s/ruleSequences.k8s';

import { RuleSequenceLink } from './RuleSequenceLink';

const ui = {
  linkText: byText('Rule sequence'),
};

describe('RuleSequenceLink', () => {
  it('renders with the correct accessible label', () => {
    const onClick = jest.fn();

    render(<RuleSequenceLink sequenceName={RULE_SEQUENCE_UID_1} ruleUid={ALERT_RULE_UID_1} onClick={onClick} />);

    expect(screen.getByRole('button', { name: /open rule sequence/i })).toBeInTheDocument();
    expect(ui.linkText.query()).toBeInTheDocument();
  });

  it('calls onClick with sequenceName and ruleUid when clicked', async () => {
    const onClick = jest.fn();
    const { user } = render(
      <RuleSequenceLink sequenceName={RULE_SEQUENCE_UID_1} ruleUid={ALERT_RULE_UID_1} onClick={onClick} />
    );

    await user.click(screen.getByRole('button', { name: /open rule sequence/i }));

    expect(onClick).toHaveBeenCalledWith(RULE_SEQUENCE_UID_1, ALERT_RULE_UID_1);
  });
});

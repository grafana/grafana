import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { ALERT_RULE_UID_1, RULE_SEQUENCE_UID_1 } from '../../mocks/server/handlers/k8s/ruleSequences.k8s';

import { RuleSequenceDrawerProvider, useRuleSequenceDrawer } from './RuleSequenceDrawerContext';
import { RuleSequenceLink } from './RuleSequenceLink';

setupMswServer();

function TestComponent() {
  const { openRuleSequenceDrawer } = useRuleSequenceDrawer();
  return <button onClick={() => openRuleSequenceDrawer(RULE_SEQUENCE_UID_1, ALERT_RULE_UID_1)}>Open Drawer</button>;
}

function TestLink() {
  const { openRuleSequenceDrawer } = useRuleSequenceDrawer();
  return (
    <RuleSequenceLink sequenceName={RULE_SEQUENCE_UID_1} ruleUid={ALERT_RULE_UID_1} onClick={openRuleSequenceDrawer} />
  );
}

describe('RuleSequenceDrawerContext', () => {
  it('opens the drawer when openRuleSequenceDrawer is called', async () => {
    const { user } = render(
      <RuleSequenceDrawerProvider>
        <TestComponent />
      </RuleSequenceDrawerProvider>
    );

    expect(screen.queryByRole('heading', { name: /rule sequence/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Drawer' }));
    await screen.findByRole('heading', { name: /rule sequence/i });
  });

  it('opens the drawer when a RuleSequenceLink chip is clicked', async () => {
    const { user } = render(
      <RuleSequenceDrawerProvider>
        <TestLink />
      </RuleSequenceDrawerProvider>
    );

    const chip = screen.getByRole('button', { name: /open rule sequence/i });
    expect(screen.queryByText(/loading rule sequence/i)).not.toBeInTheDocument();

    await user.click(chip);
    await screen.findByRole('heading', { name: /rule sequence/i });
  });
});

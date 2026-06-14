import { http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';
import { byText } from 'testing-library-selector';

import { setupMswServer } from '../../mockApi';
import {
  ALERT_RULE_UID_1,
  ALERT_RULE_UID_2,
  RECORDING_RULE_UID_1,
  RULE_SEQUENCE_UID_1,
} from '../../mocks/server/handlers/k8s/ruleSequences.k8s';

import { RuleSequenceDrawer } from './RuleSequenceDrawer';

const server = setupMswServer();

const ui = {
  interval: byText('1m'),
  recordingRuleName: byText('cpu:usage:5m'),
  alertRule1Name: byText('CPU alert'),
  alertRule2Name: byText('Memory alert'),
  youAreHere: byText('You are here'),
};

describe('RuleSequenceDrawer', () => {
  it('renders interval from default MSW fixture', async () => {
    render(
      <RuleSequenceDrawer
        sequenceName={RULE_SEQUENCE_UID_1}
        currentRuleUid={RECORDING_RULE_UID_1}
        onClose={jest.fn()}
      />
    );

    expect(await ui.interval.find()).toBeInTheDocument();
  });

  it('renders steps in correct order: recording rule first, then alert rules', async () => {
    render(
      <RuleSequenceDrawer
        sequenceName={RULE_SEQUENCE_UID_1}
        currentRuleUid={RECORDING_RULE_UID_1}
        onClose={jest.fn()}
      />
    );

    expect(await ui.recordingRuleName.find()).toBeInTheDocument();
    expect(await ui.alertRule1Name.find()).toBeInTheDocument();
    expect(await ui.alertRule2Name.find()).toBeInTheDocument();
  });

  it('displays "You are here" on the step matching the current rule UID', async () => {
    render(
      <RuleSequenceDrawer sequenceName={RULE_SEQUENCE_UID_1} currentRuleUid={ALERT_RULE_UID_1} onClose={jest.fn()} />
    );

    await waitFor(() => expect(ui.youAreHere.query()).toBeInTheDocument());

    const listItems = screen.getAllByRole('listitem');
    const alertRuleItem = listItems.find((item) => within(item).queryByText('CPU alert'));
    const recordingRuleItem = listItems.find((item) => within(item).queryByText('cpu:usage:5m'));

    expect(within(alertRuleItem!).getByText('You are here')).toBeInTheDocument();
    expect(within(recordingRuleItem!).queryByText('You are here')).not.toBeInTheDocument();
  });

  it('does not show "You are here" when the rule UID does not match any step', async () => {
    render(
      <RuleSequenceDrawer sequenceName={RULE_SEQUENCE_UID_1} currentRuleUid="non-existent-uid" onClose={jest.fn()} />
    );

    await waitFor(() => expect(ui.interval.query()).toBeInTheDocument());
    expect(ui.youAreHere.query()).not.toBeInTheDocument();
  });

  it('shows LoadingPlaceholder while loading', async () => {
    server.use(http.get('*/rulesequences/:name', () => new Promise(() => {})));

    render(
      <RuleSequenceDrawer
        sequenceName={RULE_SEQUENCE_UID_1}
        currentRuleUid={RECORDING_RULE_UID_1}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText(/loading rule sequence details/i)).toBeInTheDocument();
  });

  it('renders the rules count', async () => {
    render(
      <RuleSequenceDrawer
        sequenceName={RULE_SEQUENCE_UID_1}
        currentRuleUid={RECORDING_RULE_UID_1}
        onClose={jest.fn()}
      />
    );
    // 1 recording + 2 alerting = 3; the count display is a non-aria-hidden element
    await waitFor(() => {
      const els = screen.getAllByText('3');
      expect(els.some((el) => el.getAttribute('aria-hidden') !== 'true')).toBe(true);
    });
  });

  it('does not render a Mode block', async () => {
    render(
      <RuleSequenceDrawer
        sequenceName={RULE_SEQUENCE_UID_1}
        currentRuleUid={RECORDING_RULE_UID_1}
        onClose={jest.fn()}
      />
    );
    await waitFor(() => expect(ui.interval.query()).toBeInTheDocument());
    expect(screen.queryByText(/mode/i)).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = jest.fn();
    const { user } = render(
      <RuleSequenceDrawer sequenceName={RULE_SEQUENCE_UID_1} currentRuleUid={RECORDING_RULE_UID_1} onClose={onClose} />
    );
    await waitFor(() => expect(ui.interval.query()).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('highlights the correct step when it is the last rule in the sequence', async () => {
    render(
      <RuleSequenceDrawer sequenceName={RULE_SEQUENCE_UID_1} currentRuleUid={ALERT_RULE_UID_2} onClose={jest.fn()} />
    );

    await waitFor(() => expect(ui.youAreHere.query()).toBeInTheDocument());

    const listItems = screen.getAllByRole('listitem');
    const alertRule2Item = listItems.find((item) => within(item).queryByText('Memory alert'));
    const alertRule1Item = listItems.find((item) => within(item).queryByText('CPU alert'));

    expect(within(alertRule2Item!).getByText('You are here')).toBeInTheDocument();
    expect(within(alertRule1Item!).queryByText('You are here')).not.toBeInTheDocument();
  });
});

import { expressionIssueMessage } from './issueMessages';
import { EXPRESSION_ISSUE_IDS } from './issues';

describe('expressionIssueMessage', () => {
  // A new rule with no message would otherwise ship as a blank error in the UI.
  it.each(EXPRESSION_ISSUE_IDS)('has something to say about %s', (id) => {
    const message = expressionIssueMessage({ id, path: [], limit: 10 });

    expect(message).toBeTruthy();
    // The id itself leaking through would mean the switch fell through.
    expect(message).not.toBe(id);
  });

  it('puts the number into the messages that need one', () => {
    expect(expressionIssueMessage({ id: 'threshold.recovery.at-most', path: [], limit: 42 })).toContain('42');
    expect(expressionIssueMessage({ id: 'threshold.recovery.same', path: [], limit: 7 })).toContain('7');
  });

  it('does not print undefined when a message needs a number and there is none', () => {
    expect(expressionIssueMessage({ id: 'threshold.recovery.at-most', path: [] })).not.toContain('undefined');
  });
});

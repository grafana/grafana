import { render, screen, userEvent } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';

import { MissingAlertRuleWarning } from './MissingAlertRuleWarning';

describe('MissingAlertRuleWarning', () => {
  it('renders unavailable label and exposes tooltip on keyboard focus', async () => {
    const user = userEvent.setup();
    render(<MissingAlertRuleWarning ruleUid="test-rule-uid" />);

    expect(screen.getByText('Alert rule unavailable')).toBeInTheDocument();

    const trigger = screen.getByLabelText('Alert rule unavailable');
    await user.tab();
    expect(trigger).toHaveFocus();

    expect(await screen.findByTestId(selectors.components.Tooltip.container)).toHaveTextContent(
      /may have been deleted, or you may not have permission to view it/i
    );
    expect(screen.getByTestId(selectors.components.Tooltip.container)).toHaveTextContent('test-rule-uid');
  });
});

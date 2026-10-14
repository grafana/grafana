import { render, screen } from 'test/test-utils';

import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { RecordingRulesHeaderActions } from './RecordingRulesHeaderActions';

describe('RecordingRulesHeaderActions', () => {
  it('REC-4: shows New recording rule linking to the Recording-rule creation route', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    render(<RecordingRulesHeaderActions />);

    expect(screen.getByRole('link', { name: /new recording rule/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/alerting/new/grafana-recording')
    );
  });

  it('REC-4: renders nothing for a user without create permission', () => {
    grantUserPermissions([]);
    const { container } = render(<RecordingRulesHeaderActions />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('never offers Alert-rule creation, Generate with AI, or a More menu', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    render(<RecordingRulesHeaderActions />);

    expect(screen.queryByRole('link', { name: /new alert rule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument();
  });
});

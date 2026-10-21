import { render, screen } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { RecordingRulesHeaderActions } from './RecordingRulesHeaderActions';

describe('RecordingRulesHeaderActions', () => {
  it('links New recording rule to the creation route without returnTo, even from a filtered list', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    locationService.push('/alerting/rules/recording?search=health%3Aerror');
    render(<RecordingRulesHeaderActions />);

    expect(screen.getByRole('link', { name: /new recording rule/i })).toHaveAttribute(
      'href',
      '/alerting/new/grafana-recording'
    );
  });

  it('renders nothing for a user without create permission', () => {
    grantUserPermissions([]);
    const { container } = render(<RecordingRulesHeaderActions />);

    expect(container).toBeEmptyDOMElement();
  });
});

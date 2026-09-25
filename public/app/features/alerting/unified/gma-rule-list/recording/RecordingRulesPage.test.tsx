import { render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import RecordingRulesPage from './RecordingRulesPage';

describe('RecordingRulesPage', () => {
  const previousPermissions = contextSrv.user.permissions;

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  it('renders the Recording rules title', () => {
    contextSrv.user.permissions = {};

    render(<RecordingRulesPage />);

    expect(screen.getByText('Recording rules')).toBeInTheDocument();
  });

  it('shows New recording rule for a user with alert.rules:create', () => {
    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleCreate]: true };

    render(<RecordingRulesPage />);

    expect(screen.getByRole('link', { name: 'New recording rule' })).toHaveAttribute(
      'href',
      '/alerting/new/grafana-recording'
    );
  });

  it('hides New recording rule for a user without alert.rules:create', () => {
    contextSrv.user.permissions = {};

    render(<RecordingRulesPage />);

    expect(screen.queryByRole('link', { name: 'New recording rule' })).not.toBeInTheDocument();
  });
});

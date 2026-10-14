import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { setupMswServer } from '../../../mockApi';

import AlertRulesDeletedPage from './AlertRulesDeletedPage';

const ALERT_RULES_URL = `${getAPIBaseURL('rules.alerting.grafana.app', 'v0alpha1')}/alertrules`;

const server = setupMswServer();

describe('AlertRulesDeletedPage', () => {
  const previousRole = contextSrv.user.orgRole;

  beforeEach(() => {
    server.use(http.get(ALERT_RULES_URL, () => HttpResponse.json({ items: [], metadata: {} })));
  });

  afterEach(() => {
    contextSrv.user.orgRole = previousRole;
  });

  it('renders the Alert rules title with the Recently deleted tab selected', async () => {
    contextSrv.user.orgRole = OrgRole.Admin;

    render(<AlertRulesDeletedPage />);

    expect(screen.getByText('Alert rules')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'true');
    // Let the mounted AlertRulesRecentlyDeleted body settle so its state update lands
    // inside this test's act() scope rather than leaking into the next test.
    expect(await screen.findByText('No recently deleted rules found')).toBeInTheDocument();
  });
});

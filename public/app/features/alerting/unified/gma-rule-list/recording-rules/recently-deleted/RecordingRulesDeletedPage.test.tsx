import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { setupMswServer } from '../../../mockApi';

import RecordingRulesDeletedPage from './RecordingRulesDeletedPage';

const RECORDING_RULES_URL = `${getAPIBaseURL('rules.alerting.grafana.app', 'v0alpha1')}/recordingrules`;

const server = setupMswServer();

describe('RecordingRulesDeletedPage', () => {
  const previousRole = contextSrv.user.orgRole;

  beforeEach(() => {
    server.use(http.get(RECORDING_RULES_URL, () => HttpResponse.json({ items: [], metadata: {} })));
  });

  afterEach(() => {
    contextSrv.user.orgRole = previousRole;
  });

  it('renders the Recording rules title with the Recently deleted tab selected', async () => {
    contextSrv.user.orgRole = OrgRole.Admin;

    render(<RecordingRulesDeletedPage />);

    expect(screen.getByText('Recording rules')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Recently deleted' })).toHaveAttribute('aria-selected', 'true');
    // Let the mounted RecordingRulesRecentlyDeleted body settle so its state update lands
    // inside this test's act() scope rather than leaking into the next test.
    expect(await screen.findByText('No recently deleted rules found')).toBeInTheDocument();
  });
});

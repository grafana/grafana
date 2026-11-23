import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import server from '@grafana/test-utils/server';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

import { setupMswServer } from '../../mockApi';
import { confirmRestore } from '../deleted-rules/deletedRulesPageFixture';
import {
  FOLDER_PARENTS_URL,
  TRASH_RULES_URL,
  makeDeletedRule,
  mockRuleCreate,
  mockTrashRules,
} from '../mocks/handlers';

import { AlertRulesDeletedView } from './AlertRulesDeletedView';

setupMswServer();

describe('AlertRulesDeletedView', () => {
  beforeEach(() => {
    server.use(
      http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ items: [] })),
      // Return a known display name so tests can wait for IAM resolution
      // by asserting on the displayed name before interacting with buttons.
      http.get(/\/apis\/iam\.grafana\.app\/.*\/display/, () =>
        HttpResponse.json({
          display: [{ identity: { type: 'user', name: 'user-uid-123' }, displayName: 'Test Admin', internalId: 1 }],
          keys: ['user:user-uid-123'],
        })
      )
    );
  });

  it('shows loading state initially', async () => {
    let releasePage: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    server.use(
      http.get(TRASH_RULES_URL, async () => {
        await gate;
        return HttpResponse.json({ kind: 'AlertRuleList', metadata: {}, items: [] });
      })
    );
    render(<AlertRulesDeletedView />);
    expect(screen.getByRole('list', { name: /Loading rules/i })).toBeInTheDocument();
    releasePage();
    expect(await screen.findByText(/No recently deleted/i)).toBeInTheDocument();
  });

  it('shows deleted rules after load', async () => {
    mockTrashRules([makeDeletedRule()]);
    render(<AlertRulesDeletedView />);
    expect(await screen.findByText('Deleted rule')).toBeInTheDocument();
  });

  it('shows empty state when no deleted rules', async () => {
    mockTrashRules([]);
    render(<AlertRulesDeletedView />);
    expect(await screen.findByText(/No recently deleted/i)).toBeInTheDocument();
  });

  it('opens Review drawer when Review is clicked', async () => {
    mockTrashRules([makeDeletedRule()]);
    render(<AlertRulesDeletedView />);
    // Wait for IAM user-name resolution to settle before clicking
    await screen.findByText('Test Admin');
    await userEvent.click(screen.getByRole('button', { name: /Review/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('restores the rule and opens it', async () => {
    mockTrashRules([makeDeletedRule()]);
    mockRuleCreate('alert');
    render(<AlertRulesDeletedView />);
    await confirmRestore('Test Admin');
    await waitFor(() => expect(locationService.getLocation().pathname).toBe('/alerting/grafana/deleted-rule-uid/view'));
  });

  it('shows a conflict when a rule with the same UID exists', async () => {
    mockTrashRules([makeDeletedRule()]);
    mockRuleCreate('alert', { existingNames: ['deleted-rule-uid'] });
    render(<AlertRulesDeletedView />);
    await confirmRestore('Test Admin');
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('shows error state with retry on fetch failure', async () => {
    server.use(http.get(TRASH_RULES_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    render(<AlertRulesDeletedView />);
    expect(await screen.findByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});

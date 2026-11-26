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
  TRASH_RECORDING_RULES_URL,
  makeDeletedRecordingRule,
  mockRuleCreate,
  mockTrashRecordingRules,
} from '../mocks/handlers';

import RecordingRulesDeletedPage from './RecordingRulesDeletedPage';

setupMswServer();

describe('RecordingRulesDeletedPage (deleted view)', () => {
  beforeEach(() => {
    server.use(
      http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ items: [] })),
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
      http.get(TRASH_RECORDING_RULES_URL, async () => {
        await gate;
        return HttpResponse.json({ kind: 'RecordingRuleList', metadata: {}, items: [] });
      })
    );
    render(<RecordingRulesDeletedPage />);
    expect(screen.getByRole('list', { name: /Loading rules/i })).toBeInTheDocument();
    releasePage();
    expect(await screen.findByText(/No recently deleted/i)).toBeInTheDocument();
  });

  it('shows deleted rules after load', async () => {
    mockTrashRecordingRules([makeDeletedRecordingRule()]);
    render(<RecordingRulesDeletedPage />);
    expect(await screen.findByText('Deleted recording rule')).toBeInTheDocument();
  });

  it('shows empty state when no deleted rules', async () => {
    mockTrashRecordingRules([]);
    render(<RecordingRulesDeletedPage />);
    expect(await screen.findByText(/No recently deleted/i)).toBeInTheDocument();
  });

  it('opens Review drawer when Review is clicked', async () => {
    mockTrashRecordingRules([makeDeletedRecordingRule()]);
    render(<RecordingRulesDeletedPage />);
    await screen.findByText('Test Admin');
    await userEvent.click(screen.getByRole('button', { name: /Review/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('restores the rule and opens it', async () => {
    mockTrashRecordingRules([makeDeletedRecordingRule()]);
    mockRuleCreate('recording');
    render(<RecordingRulesDeletedPage />);
    await confirmRestore('Test Admin');
    await waitFor(() =>
      expect(locationService.getLocation().pathname).toBe('/alerting/grafana/deleted-recording-rule-uid/view')
    );
  });

  it('shows a conflict when a rule with the same UID exists', async () => {
    mockTrashRecordingRules([makeDeletedRecordingRule()]);
    mockRuleCreate('recording', { existingNames: ['deleted-recording-rule-uid'] });
    render(<RecordingRulesDeletedPage />);
    await confirmRestore('Test Admin');
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('shows error state with retry on fetch failure', async () => {
    server.use(http.get(TRASH_RECORDING_RULES_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    render(<RecordingRulesDeletedPage />);
    expect(await screen.findByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});

import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { TRASH_RULES_URL, makeDeletedRule, mockTrashRules } from '../mocks/handlers';

import { AlertRulesDeletedView } from './AlertRulesDeletedView';

setupMswServer();

describe('AlertRulesDeletedView', () => {
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
    expect(screen.getByRole('status')).toBeInTheDocument();
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
    await screen.findByText('Deleted rule');
    await userEvent.click(screen.getByRole('button', { name: /Review/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens Restore modal when Restore is clicked', async () => {
    mockTrashRules([makeDeletedRule()]);
    render(<AlertRulesDeletedView />);
    await screen.findByText('Deleted rule');
    await userEvent.click(screen.getByRole('button', { name: /Restore/i }));
    expect(await screen.findByText(/Restore "Deleted rule"/i)).toBeInTheDocument();
  });

  it('shows error state with retry on fetch failure', async () => {
    server.use(http.get(TRASH_RULES_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    render(<AlertRulesDeletedView />);
    expect(await screen.findByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});

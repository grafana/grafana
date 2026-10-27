import { render, screen, userEvent } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { ruleItem } from '../mocks/factories';
import { mockFolderParents, mockRuleSearch } from '../mocks/handlers';

import { AlertRulesListView } from './AlertRulesListView';

setupMswServer();

describe('AlertRulesListView', () => {
  beforeEach(() => {
    mockFolderParents({ 'folder-1': 'Team Alerts' });
  });

  it('shows a lower-bound total with a plus sign', async () => {
    mockRuleSearch('alert', () => ({
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: { totalHits: 1000, totalHitsRelation: 'lte' },
    }));

    render(<AlertRulesListView />);

    expect(await screen.findByText('1,000+ alert rules')).toBeInTheDocument();
  });

  it('keeps the first page total after loading more rules', async () => {
    mockRuleSearch('alert', (body) =>
      body.continue
        ? { items: [ruleItem('alert', 'rule-2', 'Memory high', 'folder-1')], metadata: { totalHits: 7 } }
        : {
            items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
            metadata: { totalHits: 2, totalHitsRelation: 'eq', continue: 'tok' },
          }
    );
    render(<AlertRulesListView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Memory high')).toBeInTheDocument();
    expect(screen.getByText('2 alert rules')).toBeInTheDocument();
  });

  it('shows a retryable error when the response is not a search result', async () => {
    mockRuleSearch('alert', () => ({ items: [{ fields: { title: 'CPU high' } }], metadata: {} }));

    render(<AlertRulesListView />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('CPU high')).not.toBeInTheDocument();
  });

  it('lists the rules without a count when the total is not a number', async () => {
    mockRuleSearch('alert', () => ({
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: { totalHits: '1000', totalHitsRelation: 'eq' },
    }));

    render(<AlertRulesListView />);

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(screen.queryByText(/alert rules?$/)).not.toBeInTheDocument();
  });
});

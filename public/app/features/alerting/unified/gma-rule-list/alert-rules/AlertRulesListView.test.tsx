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
});

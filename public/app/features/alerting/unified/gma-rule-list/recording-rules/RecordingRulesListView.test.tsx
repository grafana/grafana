import { render, screen, userEvent } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { ruleItem } from '../mocks/factories';
import { mockFolderParents, mockRuleSearch } from '../mocks/handlers';
import { createEmptyFilter } from '../rule-search/sharedRuleFilter';

import { RecordingRulesListView } from './RecordingRulesListView';

setupMswServer();

describe('RecordingRulesListView', () => {
  beforeEach(() => {
    mockFolderParents({ 'folder-1': 'Team Metrics' });
  });

  it('shows a lower-bound total with a plus sign', async () => {
    mockRuleSearch('recording', () => ({
      items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
      metadata: { totalHits: 1000, totalHitsRelation: 'lte' },
    }));

    render(<RecordingRulesListView filter={createEmptyFilter()} />);

    expect(await screen.findByText('1,000+ recording rules')).toBeInTheDocument();
  });

  it('keeps the first page total after loading more rules', async () => {
    mockRuleSearch('recording', (body) =>
      body.continue
        ? { items: [ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-1')], metadata: { totalHits: 7 } }
        : {
            items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
            metadata: { totalHits: 2, totalHitsRelation: 'eq', continue: 'tok' },
          }
    );
    render(<RecordingRulesListView filter={createEmptyFilter()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('disk:usage:rate5m')).toBeInTheDocument();
    expect(screen.getByText('2 recording rules')).toBeInTheDocument();
  });

  it('shows a retryable error when the response is not a search result', async () => {
    mockRuleSearch('recording', () => ({ items: [{ fields: { title: 'cpu:usage:rate5m' } }], metadata: {} }));

    render(<RecordingRulesListView filter={createEmptyFilter()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load recording rules');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('cpu:usage:rate5m')).not.toBeInTheDocument();
  });

  it('lists the rules without a count when the total is not a number', async () => {
    mockRuleSearch('recording', () => ({
      items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
      metadata: { totalHits: '1000', totalHitsRelation: 'eq' },
    }));

    render(<RecordingRulesListView filter={createEmptyFilter()} />);

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(screen.queryByText(/recording rules?$/)).not.toBeInTheDocument();
  });
});

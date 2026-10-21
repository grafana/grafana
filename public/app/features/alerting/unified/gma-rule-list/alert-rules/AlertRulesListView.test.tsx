import { HttpResponse, http } from 'msw';
import { useState } from 'react';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { ruleItem } from '../mocks/factories';
import { mockFolderParents, mockFullRule, mockRuleSearch, ruleSearchUrl } from '../mocks/handlers';
import { createEmptyFilter } from '../rule-search/ruleSearchFilter';

import { ListView } from './AlertRulesListView';

const server = setupMswServer();

/** Stands in for the page, which owns the filter. */
function ListWithFilter() {
  const [filter, setFilter] = useState(createEmptyFilter());
  return (
    <>
      <button onClick={() => setFilter({ ...createEmptyFilter(), text: ['cpu'] })}>Filter by name</button>
      <ListView filter={filter} />
    </>
  );
}

describe('AlertRulesListView', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    mockFolderParents({ 'folder-1': 'Team Alerts' });
    mockFullRule('alert');
  });

  it('starts the new filter at the first page and never shows a late response for the replaced filter', async () => {
    let releaseOldResponse: () => void = () => {};
    const oldResponseGate = new Promise<void>((resolve) => {
      releaseOldResponse = resolve;
    });
    const requestedFilters: unknown[] = [];
    server.use(
      http.post(ruleSearchUrl('alert'), async ({ request }) => {
        const body = (await request.json()) as { where?: unknown };
        requestedFilters.push(body.where);
        if (!body.where) {
          await oldResponseGate;
          return HttpResponse.json({
            items: [ruleItem('alert', 'rule-old', 'Old filter rule', 'folder-1')],
            metadata: { continue: 'old-tok' },
          });
        }
        return HttpResponse.json({
          items: [ruleItem('alert', 'rule-new', 'New filter rule', 'folder-1')],
          metadata: {},
        });
      })
    );

    render(<ListWithFilter />);
    await waitFor(() => expect(requestedFilters).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Filter by name' }));
    expect(await screen.findByText('New filter rule')).toBeInTheDocument();

    releaseOldResponse();
    await waitFor(() => expect(requestedFilters).toHaveLength(2));
    expect(screen.getByText('New filter rule')).toBeInTheDocument();
    expect(screen.queryByText('Old filter rule')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows a lower-bound total with a plus sign', async () => {
    mockRuleSearch('alert', () => ({
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: { totalHits: 1000, totalHitsRelation: 'lte' },
    }));

    render(<ListView filter={createEmptyFilter()} />);

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
    render(<ListView filter={createEmptyFilter()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Memory high')).toBeInTheDocument();
    expect(screen.getByText('2 alert rules')).toBeInTheDocument();
  });
});

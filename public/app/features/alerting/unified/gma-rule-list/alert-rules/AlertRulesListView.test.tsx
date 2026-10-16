import { HttpResponse, http } from 'msw';
import { useState } from 'react';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { createEmptyCriteria } from '../rule-search/criteria';

import { ListView } from './AlertRulesListView';

const server = setupMswServer();

const ALERT_SEARCH_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/searchRules';
const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';
const ALERT_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/:name';

setDataSourceSrv({
  getList: () => [],
  getInstanceSettings: () => undefined,
} as unknown as DataSourceSrv);

function ruleItem(uid: string, title: string) {
  return {
    resource: { group: 'rules.alerting.grafana.app', kind: 'AlertRule', name: uid, resource: 'alertrules' },
    fields: { title, folder: 'folder-1' },
  };
}

/** Stands in for the page, which owns the criteria. */
function ListWithFilter() {
  const [criteria, setCriteria] = useState(createEmptyCriteria());
  return (
    <>
      <button onClick={() => setCriteria({ ...createEmptyCriteria(), text: ['cpu'] })}>Filter by name</button>
      <ListView criteria={criteria} />
    </>
  );
}

describe('AlertRulesListView', () => {
  const previousPermissions = contextSrv.user.permissions;

  beforeEach(() => {
    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleRead]: true };
    server.use(
      http.get(FOLDER_PARENTS_URL, ({ params }) =>
        HttpResponse.json({ items: [{ name: params.name, title: 'Team Alerts' }] })
      ),
      http.get(ALERT_RULE_GET_URL, ({ params }) =>
        HttpResponse.json({
          apiVersion: 'v0alpha1',
          kind: 'AlertRule',
          metadata: { name: params.name },
          spec: { title: 'rule', paused: false },
        })
      )
    );
  });

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  // STATE-3
  it('starts the new criteria at the first page and never shows a late response for the replaced criteria', async () => {
    let releaseOldResponse: () => void = () => {};
    const oldResponseGate = new Promise<void>((resolve) => {
      releaseOldResponse = resolve;
    });
    const requestedFilters: unknown[] = [];
    server.use(
      http.post(ALERT_SEARCH_URL, async ({ request }) => {
        const body = (await request.json()) as { where?: unknown; continue?: string };
        requestedFilters.push(body.where);
        if (!body.where) {
          await oldResponseGate;
          return HttpResponse.json({
            items: [ruleItem('rule-old', 'Old criteria rule')],
            metadata: { continue: 'old-tok' },
          });
        }
        return HttpResponse.json({ items: [ruleItem('rule-new', 'New criteria rule')], metadata: {} });
      })
    );

    render(<ListWithFilter />);
    await waitFor(() => expect(requestedFilters).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Filter by name' }));
    expect(await screen.findByText('New criteria rule')).toBeInTheDocument();

    releaseOldResponse();
    await waitFor(() => expect(requestedFilters).toHaveLength(2));
    expect(screen.getByText('New criteria rule')).toBeInTheDocument();
    expect(screen.queryByText('Old criteria rule')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  describe('result count', () => {
    function mockSearch(metadata: Record<string, unknown>) {
      server.use(
        http.post(ALERT_SEARCH_URL, () => HttpResponse.json({ items: [ruleItem('rule-1', 'CPU high')], metadata }))
      );
    }

    it('shows the first page total with locale grouping', async () => {
      mockSearch({ totalHits: 1542, totalHitsRelation: 'eq', continue: 'tok' });
      render(<ListView criteria={createEmptyCriteria()} />);

      expect(await screen.findByText('1,542 alert rules')).toBeInTheDocument();
    });

    it('uses the singular for one rule', async () => {
      mockSearch({ totalHits: 1, totalHitsRelation: 'eq' });
      render(<ListView criteria={createEmptyCriteria()} />);

      expect(await screen.findByText('1 alert rule')).toBeInTheDocument();
    });

    it('adds a plus sign when the total is a lower bound', async () => {
      mockSearch({ totalHits: 1000, totalHitsRelation: 'lte' });
      render(<ListView criteria={createEmptyCriteria()} />);

      expect(await screen.findByText('1,000+ alert rules')).toBeInTheDocument();
    });

    it('omits the count when the response has no total, instead of counting loaded rows', async () => {
      mockSearch({});
      render(<ListView criteria={createEmptyCriteria()} />);

      expect(await screen.findByText('CPU high')).toBeInTheDocument();
      expect(screen.queryByText(/\d alert rules?$/)).not.toBeInTheDocument();
    });

    it('keeps the first page total after loading more rules', async () => {
      server.use(
        http.post(ALERT_SEARCH_URL, async ({ request }) => {
          const body = (await request.json()) as { continue?: string };
          return body.continue
            ? HttpResponse.json({ items: [ruleItem('rule-2', 'Memory high')], metadata: { totalHits: 7 } })
            : HttpResponse.json({
                items: [ruleItem('rule-1', 'CPU high')],
                metadata: { totalHits: 2, totalHitsRelation: 'eq', continue: 'tok' },
              });
        })
      );
      render(<ListView criteria={createEmptyCriteria()} />);

      await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

      expect(await screen.findByText('Memory high')).toBeInTheDocument();
      expect(screen.getByText('2 alert rules')).toBeInTheDocument();
    });
  });
});

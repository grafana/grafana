import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { createEmptyCriteria } from '../rule-search/criteria';

import { ListView } from './RecordingRulesListView';

const server = setupMswServer();

const REC_SEARCH_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/recordingrules/searchRules';
const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';
const REC_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/recordingrules/:name';

setDataSourceSrv({
  getList: () => [],
  getInstanceSettings: () => undefined,
} as unknown as DataSourceSrv);

function ruleItem(uid: string, title: string) {
  return {
    resource: { group: 'rules.alerting.grafana.app', kind: 'RecordingRule', name: uid, resource: 'recordingrules' },
    fields: { title, folder: 'folder-1' },
  };
}

describe('RecordingRulesListView result count', () => {
  const previousPermissions = contextSrv.user.permissions;

  beforeEach(() => {
    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleRead]: true };
    server.use(
      http.get(FOLDER_PARENTS_URL, ({ params }) =>
        HttpResponse.json({ items: [{ name: params.name, title: 'Team Alerts' }] })
      ),
      http.get(REC_RULE_GET_URL, ({ params }) =>
        HttpResponse.json({
          apiVersion: 'v0alpha1',
          kind: 'RecordingRule',
          metadata: { name: params.name },
          spec: { title: 'rule', paused: false },
        })
      )
    );
  });

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  function mockSearch(metadata: Record<string, unknown>) {
    server.use(
      http.post(REC_SEARCH_URL, () => HttpResponse.json({ items: [ruleItem('rule-1', 'cpu:avg')], metadata }))
    );
  }

  it('shows the first page total with locale grouping', async () => {
    mockSearch({ totalHits: 2345, totalHitsRelation: 'eq' });
    render(<ListView criteria={createEmptyCriteria()} />);

    expect(await screen.findByText('2,345 recording rules')).toBeInTheDocument();
  });

  it('uses the singular for one rule', async () => {
    mockSearch({ totalHits: 1, totalHitsRelation: 'eq' });
    render(<ListView criteria={createEmptyCriteria()} />);

    expect(await screen.findByText('1 recording rule')).toBeInTheDocument();
  });

  it('adds a plus sign when the total is a lower bound', async () => {
    mockSearch({ totalHits: 1000, totalHitsRelation: 'lte' });
    render(<ListView criteria={createEmptyCriteria()} />);

    expect(await screen.findByText('1,000+ recording rules')).toBeInTheDocument();
  });

  it('omits the count when the response has no total', async () => {
    mockSearch({});
    render(<ListView criteria={createEmptyCriteria()} />);

    expect(await screen.findByText('cpu:avg')).toBeInTheDocument();
    expect(screen.queryByText(/\d recording rules?$/)).not.toBeInTheDocument();
  });
});

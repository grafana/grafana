import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { type AlertRule, type AlertRuleList } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { AlertRulesRecentlyDeleted } from './AlertRulesRecentlyDeleted';

const ALERT_RULES_URL = `${getAPIBaseURL('rules.alerting.grafana.app', 'v0alpha1')}/alertrules`;
const FOLDER_PARENTS_URL = `${getAPIBaseURL('folder.grafana.app', 'v1beta1')}/folders/:name/parents`;
const DISPLAY_MAPPING_URL = `${getAPIBaseURL('iam.grafana.app', 'v0alpha1')}/display`;

function buildAlertRule(overrides: Partial<AlertRule> = {}, specOverrides: Partial<AlertRule['spec']> = {}): AlertRule {
  return {
    apiVersion: 'v0alpha1',
    kind: 'AlertRule',
    metadata: {
      name: 'rule-uid-1',
      annotations: {
        'grafana.app/folder': 'folder-uid-1',
        'grafana.app/updatedBy': 'user:1',
      },
      deletionTimestamp: '2024-05-01T00:00:00Z',
    },
    spec: {
      title: 'High CPU usage',
      execErrState: 'Alerting',
      noDataState: 'NoData',
      trigger: { interval: '1m' },
      expressions: {},
      ...specOverrides,
    },
    ...overrides,
  };
}

function mockAlertRulesResponse(response: AlertRuleList, requestAssertions?: (url: URL) => void) {
  server.use(
    http.get(ALERT_RULES_URL, ({ request }) => {
      requestAssertions?.(new URL(request.url));
      return HttpResponse.json(response);
    })
  );
}

function mockFolderAndUserLookups() {
  server.use(
    http.get(FOLDER_PARENTS_URL, ({ params }) => {
      return HttpResponse.json({
        items: [{ name: String(params.name), title: 'Production' }],
      });
    }),
    http.get(DISPLAY_MAPPING_URL, ({ request }) => {
      const keys = new URL(request.url).searchParams.getAll('key');
      return HttpResponse.json({
        keys,
        display: keys.map((key) => ({ identity: { type: 'user', name: key }, displayName: `Display of ${key}` })),
      });
    })
  );
}

setBackendSrv(backendSrv);
setupMockServer();

describe('AlertRulesRecentlyDeleted', () => {
  beforeEach(() => {
    mockFolderAndUserLookups();
  });

  it('ADEL-1: requests only the AlertRule trash selector, with no title/folder/user filter controls', async () => {
    let requestedSelector: string | null = null;
    mockAlertRulesResponse({ items: [buildAlertRule()], metadata: {} }, (url) => {
      requestedSelector = url.searchParams.get('labelSelector');
    });

    render(<AlertRulesRecentlyDeleted />);

    await screen.findByText('High CPU usage');

    expect(requestedSelector).toBe('grafana.app/get-trash=true');
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /filter/i })).not.toBeInTheDocument();
  });

  it('ADEL-2: reveals more than 40 rows from an oversized response in a 40-row chunk via Load more, without duplicate requests', async () => {
    let requestCount = 0;
    const rules = Array.from({ length: 65 }, (_, i) =>
      buildAlertRule({ metadata: { name: `rule-${i}` } }, { title: `Rule ${i}` })
    );
    mockAlertRulesResponse({ items: rules, metadata: {} }, () => {
      requestCount += 1;
    });

    const { user } = render(<AlertRulesRecentlyDeleted />);

    await screen.findByText('Rule 0');
    expect(screen.queryByText('Rule 40')).not.toBeInTheDocument();
    expect(requestCount).toBe(1);

    await user.click(screen.getByRole('button', { name: /load more/i }));

    await screen.findByText('Rule 40');
    expect(screen.getByText('Rule 64')).toBeInTheDocument();
    // The remaining rows came from the local buffer - no second network request was needed.
    expect(requestCount).toBe(1);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('ADEL-2: follows a metadata.continue token via Load more', async () => {
    const requestedTokens: Array<string | null> = [];
    server.use(
      http.get(ALERT_RULES_URL, ({ request }) => {
        const url = new URL(request.url);
        const continueToken = url.searchParams.get('continue');
        requestedTokens.push(continueToken);
        if (!continueToken) {
          return HttpResponse.json({
            items: [buildAlertRule({ metadata: { name: 'rule-page1' } }, { title: 'Page 1 rule' })],
            metadata: { continue: 'next-page-token' },
          });
        }
        return HttpResponse.json({
          items: [buildAlertRule({ metadata: { name: 'rule-page2' } }, { title: 'Page 2 rule' })],
          metadata: {},
        });
      })
    );

    const { user } = render(<AlertRulesRecentlyDeleted />);

    await screen.findByText('Page 1 rule');
    await user.click(screen.getByRole('button', { name: /load more/i }));

    await screen.findByText('Page 2 rule');
    expect(requestedTokens).toEqual([null, 'next-page-token']);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('ADEL-3: shows title, resolved folder path, deletion time, and resolved deleting user, and opens Review', async () => {
    mockAlertRulesResponse({ items: [buildAlertRule()], metadata: {} });

    const { user } = render(<AlertRulesRecentlyDeleted />);

    await screen.findByText('High CPU usage');
    await screen.findByText('Production');
    await screen.findByText(/Display of user:1/);
    // Query the row fresh, now that its async folder/deleted-by lookups have settled - otherwise
    // the click below can target a node that gets replaced mid-flight.
    const row = screen.getByText('High CPU usage').closest('tr');
    expect(row).not.toBeNull();

    await user.click(within(row!).getByRole('button', { name: /review/i }));

    expect(await screen.findByText('Deleted alert rule')).toBeInTheDocument();
    expect(screen.getAllByText('High CPU usage').length).toBeGreaterThan(0);
  });

  it('ADEL-4: shows an error (not the empty state) when the initial request fails', async () => {
    server.use(http.get(ALERT_RULES_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    render(<AlertRulesRecentlyDeleted />);

    expect(await screen.findByText(/unable to load recently deleted rules/i)).toBeInTheDocument();
    expect(screen.queryByText(/no recently deleted rules found/i)).not.toBeInTheDocument();
  });

  it('ADEL-4: shows the empty state only after a successful empty response', async () => {
    mockAlertRulesResponse({ items: [], metadata: {} });

    render(<AlertRulesRecentlyDeleted />);

    expect(await screen.findByText(/no recently deleted rules found/i)).toBeInTheDocument();
  });

  it('ADEL-4: falls back to the folder UID when the folder lookup fails, without disabling the row', async () => {
    mockAlertRulesResponse({ items: [buildAlertRule()], metadata: {} });
    server.use(http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ message: 'not found' }, { status: 404 })));

    render(<AlertRulesRecentlyDeleted />);

    const row = (await screen.findByText('High CPU usage')).closest('tr');
    await waitFor(() => expect(within(row!).getByText('folder-uid-1')).toBeInTheDocument());
    expect(within(row!).getByRole('button', { name: /review/i })).toBeEnabled();
  });
});

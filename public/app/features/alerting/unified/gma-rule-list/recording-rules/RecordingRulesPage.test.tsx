import { HttpResponse, http } from 'msw';
import { Suspense } from 'react';
import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import { locationService, reportInteraction } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import server from '@grafana/test-utils/server';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { folderItem, ruleItem } from '../mocks/factories';
import {
  type SearchRequestBody,
  mockFolderCounts,
  mockFolderParents,
  mockFolderSearch,
  mockFullRule,
  mockRuleSearch,
  ruleSearchUrl,
} from '../mocks/handlers';

import RecordingRulesPage from './RecordingRulesPage';

// test-utils swaps locationService per render; a plain spread would freeze the first one.
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return Object.defineProperty({ ...actual, reportInteraction: jest.fn() }, 'locationService', {
    enumerable: true,
    get: () => actual.locationService,
  });
});

// jsdom reports zero size, so Combobox renders no option rows.
mockComboboxRect();

const reportInteractionMock = jest.mocked(reportInteraction);

setupMswServer();

const RECORDING_SEARCH_URL = ruleSearchUrl('recording');

function recordingRule(uid: string, title: string, folder: string) {
  return ruleItem('recording', uid, title, folder);
}

// GrafanaRoute provides this boundary in the app; the page suspends until saved searches are set up.
function renderPage(options?: Parameters<typeof render>[1]) {
  // eslint-disable-next-line testing-library/no-unnecessary-act
  return act(async () =>
    render(
      <Suspense>
        <RecordingRulesPage />
      </Suspense>,
      options
    )
  );
}

/** Serves the first page with a continuation token; `nextPage` answers every request that carries one. */
function mockPagedSearch(nextPage: (token: string) => Response | Promise<Response>) {
  const continuations: Array<string | null> = [];
  server.use(
    http.post(ruleSearchUrl('recording'), async ({ request }) => {
      const { continue: token } = (await request.json()) as { continue?: string };
      continuations.push(token ?? null);
      if (!token) {
        return HttpResponse.json({
          items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
          metadata: { continue: 'tok' },
        });
      }
      return nextPage(token);
    })
  );
  return continuations;
}

function secondPage() {
  return HttpResponse.json({ items: [ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-2')], metadata: {} });
}

describe('RecordingRulesPage', () => {
  beforeEach(() => {
    reportInteractionMock.mockClear();
    setupDataSources();
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    mockFolderParents({ 'folder-1': 'Team Alerts', 'folder-2': 'Infra' });
    mockFolderCounts('recording', { 'folder-1': 3, 'folder-2': 0 });
    mockFullRule('recording');
  });

  it('shows New recording rule for a user with alert.rules:create', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleCreate]);

    await renderPage();

    expect(screen.getByRole('link', { name: 'New recording rule' })).toHaveAttribute(
      'href',
      expect.stringContaining('/alerting/new/grafana-recording')
    );
    // Settle the saved-searches load so its state update stays inside this test's act().
    await screen.findByRole('button', { name: 'Saved searches' });
  });

  it('Folders mode starts with collapsed, title-sorted folders showing their direct Recording-rule count', async () => {
    mockFolderSearch(() => ({
      items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
      metadata: {},
    }));

    await renderPage();

    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(screen.getByText('Infra')).toBeInTheDocument();
    expect(await screen.findByText('3 recording rules')).toBeInTheDocument();
  });

  it('expanding a folder loads only that folder Recording rules, filtered by folder UID', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    let lastBody: SearchRequestBody | undefined;
    mockRuleSearch('recording', (body) => {
      lastBody = body;
      return { items: [recordingRule('rule-1', 'cpu_usage:avg', 'folder-1')], metadata: {} };
    });

    const { user } = await renderPage();
    await screen.findByText('Team Alerts');

    await user.click(screen.getByRole('button', { name: 'Expand Team Alerts', expanded: false }));

    expect(await screen.findByText('cpu_usage:avg')).toBeInTheDocument();
    expect(lastBody?.where).toEqual({ filter: { field: 'folder', operator: 'In', values: ['folder-1'] } });
  });

  it('retries a failed first List page and then shows its rules', async () => {
    let call = 0;
    server.use(
      http.post(RECORDING_SEARCH_URL, () => {
        call += 1;
        return call === 1
          ? HttpResponse.json({ message: 'boom' }, { status: 500 })
          : HttpResponse.json({ items: [recordingRule('rule-1', 'cpu_usage:avg', 'folder-1')], metadata: {} });
      })
    );

    const { user } = await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load recording rules');

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('cpu_usage:avg')).toBeInTheDocument();
  });

  it('starts a new filter at the first page and never shows a late response for the replaced filter', async () => {
    let releaseOldResponse: () => void = () => {};
    const oldResponseGate = new Promise<void>((resolve) => {
      releaseOldResponse = resolve;
    });
    const requests: Array<{ where?: unknown; token: string | null }> = [];
    server.use(
      http.post(RECORDING_SEARCH_URL, async ({ request }) => {
        const body = (await request.json()) as { where?: unknown; continue?: string };
        requests.push({ where: body.where, token: body.continue ?? null });
        if (!body.where) {
          await oldResponseGate;
          return HttpResponse.json({
            items: [recordingRule('rule-old', 'old_filter:avg', 'folder-1')],
            metadata: { continue: 'old-tok' },
          });
        }
        return HttpResponse.json({ items: [recordingRule('rule-new', 'new_filter:avg', 'folder-1')], metadata: {} });
      })
    );

    const { user } = await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });
    await waitFor(() => expect(requests).toHaveLength(1));

    await user.type(await screen.findByRole('textbox', { name: 'Search' }), 'cpu{Enter}');
    expect(await screen.findByText('new_filter:avg')).toBeInTheDocument();

    releaseOldResponse();
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toEqual({ where: { text: { value: 'cpu' } }, token: null });
    expect(screen.getByText('new_filter:avg')).toBeInTheDocument();
    expect(screen.queryByText('old_filter:avg')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('emits grafana_alerting_gma_rule_list_view once on mount with the kind and mode', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));
    mockRuleSearch('recording', () => ({ items: [], metadata: {} }));

    await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });

    await screen.findByText('No recording rules found');

    const pageViewCalls = reportInteractionMock.mock.calls.filter(
      ([event]) => event === 'grafana_alerting_gma_rule_list_view'
    );
    expect(pageViewCalls).toEqual([['grafana_alerting_gma_rule_list_view', { kind: 'recording', mode: 'list' }]]);
  });

  it('lists a legacy saved search as soon as the page shows', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));
    localStorage.clear();
    await new UserStorage('alerting').setItem(
      'savedSearches',
      JSON.stringify([
        { id: 'legacy-1', name: 'Legacy errors', query: 'type:recording health:error', isDefault: false, createdAt: 1 },
      ])
    );

    const { user } = await renderPage();
    await user.click(screen.getByRole('button', { name: 'Saved searches' }));

    expect(await screen.findByRole('link', { name: 'Legacy errors' })).toBeInTheDocument();
  });

  describe('search and filters', () => {
    function urlSearchParams() {
      return new URLSearchParams(locationService.getLocation().search);
    }

    let ruleSearchBodies: Array<{ where?: unknown }>;

    beforeEach(() => {
      localStorage.clear();
      mockFolderSearch(() => ({
        items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
        metadata: {},
      }));
      ruleSearchBodies = [];
      mockRuleSearch('recording', (body) => {
        ruleSearchBodies.push(body as { where?: unknown });
        return { items: [recordingRule('rule-1', 'CPU recorded', 'folder-1')], metadata: {} };
      });
    });

    it('keeps a multi-token query exactly as typed and sends the applied filter as one request', async () => {
      const { user } = await renderPage();
      const typed = 'metric:cpu_usage  cpu health:ok';

      await user.type(await screen.findByRole('textbox', { name: 'Search' }), `${typed}{Enter}`);

      expect(await screen.findByText('CPU recorded')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue(typed);
      expect(urlSearchParams().get('search')).toBe('metric:cpu_usage health:ok cpu');
      expect(ruleSearchBodies.at(-1)?.where).toEqual({
        and: [
          { text: { value: 'cpu' } },
          { filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] } },
          { filter: { field: 'health', operator: 'In', values: ['Recording'] } },
        ],
      });
    });

    it('sends health In [NoData] for health:nodata and shows it in the sidebar', async () => {
      await renderPage({ historyOptions: { initialEntries: ['/?search=health%3Anodata&view=list'] } });

      expect(await screen.findByText('CPU recorded')).toBeInTheDocument();
      expect(ruleSearchBodies.at(-1)?.where).toEqual({
        filter: { field: 'health', operator: 'In', values: ['NoData'] },
      });
      expect(screen.getByRole('combobox', { name: 'Health' })).toHaveValue('No data');
    });

    it('shows an Alert-only state token as an invalid filter and sends no request', async () => {
      await renderPage({ historyOptions: { initialEntries: ['/?search=state%3Afiring&view=list'] } });

      expect(await screen.findByText('Some filters could not be applied: state')).toBeInTheDocument();
      expect(screen.getByText('Fix the invalid filter to see results')).toBeInTheDocument();
      expect(ruleSearchBodies).toEqual([]);
    });

    it('rendering again from the URL restores the input, the sidebar and the request', async () => {
      const { user, unmount } = await renderPage();
      await user.type(
        await screen.findByRole('textbox', { name: 'Search' }),
        'cpu metric:cpu_usage health:error label:team=api{Enter}'
      );
      await screen.findByText('CPU recorded');
      const { pathname, search } = locationService.getLocation();
      unmount();
      ruleSearchBodies.length = 0;

      await renderPage({ historyOptions: { initialEntries: [`${pathname}${search}`] } });

      expect(await screen.findByText('CPU recorded')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue(
        'label:team=api metric:cpu_usage health:error cpu'
      );
      expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('team');
      expect(screen.getByRole('textbox', { name: 'Recorded metric' })).toHaveValue('cpu_usage');
      expect(screen.getByRole('combobox', { name: 'Health' })).toHaveValue('Error');
      expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
      expect(ruleSearchBodies.at(-1)?.where).toEqual({
        and: [
          { text: { value: 'cpu' } },
          { filter: { field: 'labels', operator: 'In', values: ['team=api'] } },
          { filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] } },
          { filter: { field: 'health', operator: 'In', values: ['Error'] } },
        ],
      });
    });

    describe('saved searches', () => {
      const ALERT_SEARCH = {
        id: 'alert-1',
        name: 'Alert search',
        query: 'paused:true',
        isDefault: false,
        createdAt: 1,
      };

      async function readCollection(key: string): Promise<Array<{ name: string; query: string; isDefault: boolean }>> {
        return JSON.parse((await new UserStorage('alerting').getItem(key)) ?? '[]');
      }

      async function seed(key: string, searches: object[]) {
        await new UserStorage('alerting').setItem(key, JSON.stringify(searches));
      }

      async function openSavedSearches(user: Awaited<ReturnType<typeof renderPage>>['user']) {
        await waitFor(() => expect(screen.getByRole('button', { name: 'Saved searches' })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: 'Saved searches' }));
      }

      it('saves, renames, sets as default and deletes a search in the Recording collection and leaves the Alert one untouched', async () => {
        await seed('alertRulesSavedSearches', [ALERT_SEARCH]);
        const { user } = await renderPage({ historyOptions: { initialEntries: ['/?search=cpu&view=list'] } });
        await screen.findByText('CPU recorded');
        await openSavedSearches(user);

        await user.click(await screen.findByRole('button', { name: 'Save current search' }));
        await user.type(await screen.findByPlaceholderText('Enter a name...'), 'CPU metrics');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByRole('link', { name: 'CPU metrics' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Alert search' })).not.toBeInTheDocument();
        expect(await readCollection('recordingRulesSavedSearches')).toEqual([
          expect.objectContaining({ name: 'CPU metrics', query: 'cpu', isDefault: false }),
        ]);

        await user.click(screen.getByRole('button', { name: 'Actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
        const nameInput = await screen.findByDisplayValue('CPU metrics');
        await user.clear(nameInput);
        await user.type(nameInput, 'Recorded CPU{Enter}');

        expect(await screen.findByRole('link', { name: 'Recorded CPU' })).toBeInTheDocument();
        expect(await readCollection('recordingRulesSavedSearches')).toEqual([
          expect.objectContaining({ name: 'Recorded CPU', query: 'cpu' }),
        ]);

        await user.click(screen.getByRole('button', { name: 'Actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Set as default' }));

        await waitFor(async () =>
          expect(await readCollection('recordingRulesSavedSearches')).toEqual([
            expect.objectContaining({ name: 'Recorded CPU', isDefault: true }),
          ])
        );

        await user.click(screen.getByRole('button', { name: 'Actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
        await user.click(await screen.findByRole('button', { name: 'Delete' }));

        await waitFor(async () => expect(await readCollection('recordingRulesSavedSearches')).toEqual([]));
        expect(await readCollection('alertRulesSavedSearches')).toEqual([ALERT_SEARCH]);
      });
    });

    it('applies the Recording default saved search, not the Alert one, when the page opens with no query', async () => {
      const storage = new UserStorage('alerting');
      await storage.setItem(
        'recordingRulesSavedSearches',
        JSON.stringify([
          { id: 'rec-1', name: 'Recording default', query: 'health:error', isDefault: true, createdAt: 1 },
        ])
      );
      await storage.setItem(
        'alertRulesSavedSearches',
        JSON.stringify([{ id: 'alert-1', name: 'Alert default', query: 'cpu', isDefault: true, createdAt: 1 }])
      );

      await renderPage();

      expect(await screen.findByText('CPU recorded')).toBeInTheDocument();
      expect(urlSearchParams().get('search')).toBe('health:error');
      expect(ruleSearchBodies.map((body) => body.where)).toEqual([
        { filter: { field: 'health', operator: 'In', values: ['Error'] } },
      ]);
    });
  });

  describe('in List mode', () => {
    // An explicit empty search skips the default saved search that other tests in this file set.
    it('lists the Recording rules in the order the search returns them, each with its folder path', async () => {
      mockRuleSearch('recording', () => ({
        items: [
          ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1'),
          ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-2'),
        ],
        metadata: {},
      }));

      await renderPage({ historyOptions: { initialEntries: ['/?view=list&search='] } });

      const rows = await screen.findAllByRole('listitem');
      expect(rows.map((row) => row.querySelector('a')?.textContent)).toEqual(['cpu:usage:rate5m', 'disk:usage:rate5m']);
      expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
      expect(await screen.findByText('Infra')).toBeInTheDocument();
    });

    it('asks searchRecordingRules for 40 rules sorted by title, with no filter', async () => {
      let body: unknown;
      mockRuleSearch('recording', (received) => {
        body = received;
        return { items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')], metadata: {} };
      });

      await renderPage({ historyOptions: { initialEntries: ['/?view=list&search='] } });

      expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
      expect(body).toMatchObject({ kind: 'SearchQuery', sort: [{ field: 'title', direction: 'asc' }], limit: 40 });
      expect(body).not.toHaveProperty('where');
    });

    it("shows the first page's total as the result count", async () => {
      mockRuleSearch('recording', () => ({
        items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
        metadata: { totalHits: 42, totalHitsRelation: 'eq' },
      }));

      await renderPage({ historyOptions: { initialEntries: ['/?view=list&search='] } });

      expect(await screen.findByText('42 recording rules')).toBeInTheDocument();
    });

    it('shows skeleton rows in a busy list until the first page arrives', async () => {
      let releasePage: () => void = () => {};
      const pageGate = new Promise<void>((resolve) => {
        releasePage = resolve;
      });
      server.use(
        http.post(ruleSearchUrl('recording'), async () => {
          await pageGate;
          return HttpResponse.json({
            items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
            metadata: {},
          });
        })
      );

      await renderPage({ historyOptions: { initialEntries: ['/?view=list&search='] } });

      expect(await screen.findByRole('list', { name: 'Loading rules' })).toHaveAttribute('aria-busy', 'true');
      releasePage();
      expect(await screen.findByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Loading rules' })).not.toBeInTheDocument();
    });

    it('shows the empty state after a successful empty response', async () => {
      mockRuleSearch('recording', () => ({ items: [], metadata: {} }));

      await renderPage({ historyOptions: { initialEntries: ['/?view=list&search='] } });

      expect(await screen.findByText('No recording rules found')).toBeInTheDocument();
    });

    it('keeps loaded rows when Load more fails, and reloads them with fresh tokens on Retry', async () => {
      const continuations: Array<string | null> = [];
      let firstPages = 0;
      let failNext = true;
      server.use(
        http.post(ruleSearchUrl('recording'), async ({ request }) => {
          const { continue: token } = (await request.json()) as { continue?: string };
          continuations.push(token ?? null);
          if (!token) {
            firstPages += 1;
            return HttpResponse.json({
              items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
              // The reloaded first page hands out a new token, so a replayed one is detectable.
              metadata: { continue: firstPages === 1 ? 'tok' : 'tok-fresh' },
            });
          }
          if (token === 'tok' || token === 'tok-fresh') {
            return HttpResponse.json({
              items: [ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-2')],
              metadata: { continue: 'tok-2' },
            });
          }
          if (failNext) {
            failNext = false;
            return HttpResponse.json({ message: 'expired' }, { status: 410 });
          }
          return HttpResponse.json({
            items: [ruleItem('recording', 'rule-3', 'mem:usage:rate5m', 'folder-1')],
            metadata: {},
          });
        })
      );

      await renderPage({ historyOptions: { initialEntries: ['/?view=list&search='] } });

      await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
      await screen.findByText('disk:usage:rate5m');
      await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
      expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
      expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

      // Retry reloads both loaded pages from the first one, taking the second page's token from the reloaded first page.
      await waitFor(() => expect(continuations).toEqual([null, 'tok', 'tok-2', null, 'tok-fresh']));
      expect(await screen.findByRole('button', { name: 'Load more' })).toBeEnabled();
      expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
      expect(screen.getByText('disk:usage:rate5m')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

      expect(await screen.findByText('mem:usage:rate5m')).toBeInTheDocument();
    });

    it('keeps loaded rows and names the refresh as failed when the reload on Retry fails too', async () => {
      let calls = 0;
      server.use(
        http.post(ruleSearchUrl('recording'), () => {
          calls += 1;
          if (calls === 1) {
            return HttpResponse.json({
              items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
              metadata: { continue: 'tok' },
            });
          }
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        })
      );

      await renderPage({ historyOptions: { initialEntries: ['/?view=list&search='] } });

      await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

      expect(await screen.findByText('Failed to refresh results')).toBeInTheDocument();
      expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
    });

    it('loads one page once when Load more is double clicked', async () => {
      let releasePage: () => void = () => {};
      const pageGate = new Promise<void>((resolve) => {
        releasePage = resolve;
      });
      const continuations = mockPagedSearch(async () => {
        await pageGate;
        return secondPage();
      });

      await renderPage({ historyOptions: { initialEntries: ['/?view=list&search='] } });

      await screen.findByText('cpu:usage:rate5m');
      await userEvent.dblClick(screen.getByRole('button', { name: 'Load more' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled());
      releasePage();

      expect(await screen.findByText('disk:usage:rate5m')).toBeInTheDocument();
      expect(continuations).toEqual([null, 'tok']);
    });
  });
});

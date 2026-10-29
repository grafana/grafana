import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { alertRuleFactory, folderFactory } from '../mocks/factories';
import { ruleSearchUrl } from '../mocks/handlers';
import { type RuleListBackend, setupRuleListBackend } from '../mocks/ruleListBackend';

import AlertRulesPage from './AlertRulesPage';

setupMswServer();

const FOLDERS = [folderFactory.build({ metadata: { name: 'folder-1' }, spec: { title: 'Team Alerts' } })];

const ALERT_RULES = [
  alertRuleFactory.inFolder('folder-1').build({ spec: { title: 'CPU high load' } }),
  alertRuleFactory.inFolder('folder-1').build({ spec: { title: 'Disk full' } }),
  alertRuleFactory.inFolder('folder-1').build({ spec: { title: 'Memory high' } }),
];

function setup(options: Partial<Parameters<typeof setupRuleListBackend>[0]> = {}) {
  return setupRuleListBackend({ folders: FOLDERS, alertRules: ALERT_RULES, ...options });
}

/** Folders is the default view; List tests open the page with `view=list`. */
function renderInListMode() {
  return render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });
}

describe('AlertRulesPage search', () => {
  let backend: RuleListBackend;

  function searchParam() {
    return new URLSearchParams(locationService.getLocation().search).get('search');
  }

  function searchInput() {
    return screen.getByRole('textbox', { name: 'Search' });
  }

  beforeEach(() => {
    backend = setup();
  });

  it('keeps a multi-token query exactly as typed in the input and the URL, and sends it as one request', async () => {
    const { user } = renderInListMode();
    await screen.findByText('CPU high load');
    const typed = 'paused:true cpu label:team=api  folder:folder-1';

    await user.type(searchInput(), `${typed}{Enter}`);

    await waitFor(() =>
      expect(backend.ruleSearches.at(-1)?.where).toEqual({
        and: [
          { text: { value: 'cpu' } },
          { filter: { field: 'folder', operator: 'In', values: ['folder-1'] } },
          { filter: { field: 'labels', operator: 'In', values: ['team=api'] } },
          { filter: { field: 'paused', operator: 'In', values: ['true'] } },
        ],
      })
    );
    expect(backend.ruleSearches).toHaveLength(2);
    expect(searchInput()).toHaveValue(typed);
    expect(searchParam()).toBe(typed);
  });

  it('restores the input and the request from the URL on load', async () => {
    render(<AlertRulesPage />, {
      historyOptions: { initialEntries: ['/?search=folder%3Afolder-1%20label%3Ateam%3D~api.*%20%22high%20load%22'] },
    });

    expect(await screen.findByText('CPU high load')).toBeInTheDocument();
    expect(searchInput()).toHaveValue('folder:folder-1 label:team=~api.* "high load"');
    expect(backend.ruleSearches.map((body) => body.where)).toEqual([
      {
        and: [
          { text: { value: 'high load' } },
          { filter: { field: 'folder', operator: 'In', values: ['folder-1'] } },
          { regex: { field: 'labels', pattern: 'team=api.*' } },
        ],
      },
    ]);
  });

  it('searches titles for a key:value word the page has no filter for, and keeps it as typed in the URL', async () => {
    const { user } = renderInListMode();
    await screen.findByText('CPU high load');

    await user.type(searchInput(), 'foo:bar metric:cpu{Enter}');

    await waitFor(() => expect(backend.ruleSearches.at(-1)?.where).toEqual({ text: { value: 'foo:bar metric:cpu' } }));
    expect(searchParam()).toBe('foo:bar metric:cpu');
    expect(searchInput()).not.toHaveAttribute('aria-invalid');
  });

  it.each([
    ['cpu label:', 'Some filters could not be applied: label'],
    ['state:inactive', 'Use state:normal instead of state:inactive.'],
    ['state:foo', 'Use one of these values for state: firing, pending, recovering, normal'],
    [
      'health:bad label:',
      'Some filters could not be applied: label Use one of these values for health: ok, nodata, error, unknown',
    ],
    ['contactPoint:on-call policy:escalation', 'Some filters could not be applied: contactPoint'],
    ['policy:default paused:false', 'Some filters are not available yet: policy, paused'],
    ['cpu*', 'Search text cannot contain * or %.'],
    ['cpu "high', 'A quote in the search is not closed.'],
  ])('shows why %j cannot be searched, keeps it as typed and sends no request', async (search, message) => {
    render(<AlertRulesPage />, { historyOptions: { initialEntries: [`/?${new URLSearchParams({ search })}`] } });

    expect(await screen.findByText('Change the search to see results')).toBeInTheDocument();
    expect(searchInput()).toHaveValue(search);
    expect(searchInput()).toHaveAttribute('aria-invalid', 'true');
    expect(searchInput()).toHaveAccessibleDescription(message);
    expect(backend.ruleSearches).toEqual([]);
  });

  it('sends no request for an invalid query typed into the input, and searches again once it is fixed', async () => {
    const { user } = renderInListMode();
    await screen.findByText('CPU high load');

    await user.type(searchInput(), 'panelId:4{Enter}');

    expect(await screen.findByText('Change the search to see results')).toBeInTheDocument();
    expect(backend.ruleSearches).toHaveLength(1);

    await user.tripleClick(searchInput());
    await user.keyboard('dashboard:dash-1 panelId:4{Enter}');

    await waitFor(() =>
      expect(backend.ruleSearches.at(-1)?.where).toEqual({
        and: [
          { filter: { field: 'dashboardUID', operator: 'In', values: ['dash-1'] } },
          { filter: { field: 'panelID', operator: 'In', values: ['4'] } },
        ],
      })
    );
    expect(await screen.findByText('CPU high load')).toBeInTheDocument();
  });

  it.each([
    ['where.and[1].regex.pattern', 'label was rejected: Invalid value: "team=(": missing closing )'],
    ['limit', 'The search was rejected: Invalid value: "team=(": missing closing )'],
  ])('shows a 422 with a cause on %s under the input as %j, with no Retry', async (field, description) => {
    server.use(
      http.post(ruleSearchUrl('alert'), () =>
        HttpResponse.json(
          { code: 422, details: { causes: [{ field, message: 'Invalid value: "team=(": missing closing )' }] } },
          { status: 422 }
        )
      )
    );
    render(<AlertRulesPage />, {
      historyOptions: { initialEntries: [`/?${new URLSearchParams({ search: 'cpu label:team=~(' })}`] },
    });

    expect(await screen.findByText('Change the search to see results')).toBeInTheDocument();
    expect(searchInput()).toHaveAttribute('aria-invalid', 'true');
    expect(searchInput()).toHaveAccessibleDescription(description);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('restarts paging from the first page when a new query is applied', async () => {
    backend = setup({ pageSize: { rules: 1 } });
    const { user } = renderInListMode();
    await user.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Disk full')).toBeInTheDocument();

    await user.type(searchInput(), 'memory{Enter}');

    expect(await screen.findByText('Memory high')).toBeInTheDocument();
    expect(screen.queryByText('Disk full')).not.toBeInTheDocument();
    expect(screen.queryByText('CPU high load')).not.toBeInTheDocument();
    expect(backend.ruleSearches.map((body) => body.continue ?? null)).toEqual([null, '1', null]);
  });

  it('clearing the input with the clear button returns to Folders mode', async () => {
    const { user } = render(<AlertRulesPage />);
    await screen.findByRole('button', { name: 'Expand Team Alerts' });
    await user.type(searchInput(), 'cpu{Enter}');

    expect(await screen.findByText('CPU high load')).toBeInTheDocument();
    expect(backend.ruleSearches.at(-1)?.where).toEqual({ text: { value: 'cpu' } });

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(await screen.findByRole('button', { name: 'Expand Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(searchParam()).toBe('');
    expect(searchInput()).toHaveValue('');
  });

  it('Back and Forward restore the input and the request for each applied query', async () => {
    const { user } = renderInListMode();
    await screen.findByText('CPU high load');
    await user.type(searchInput(), 'cpu{Enter}');
    await waitFor(() => expect(searchParam()).toBe('cpu'));
    // Typing over the selection replaces the query without emptying the input first.
    await user.tripleClick(searchInput());
    await user.keyboard('plugins:hide cpu{Enter}');
    await waitFor(() => expect(searchParam()).toBe('plugins:hide cpu'));

    act(() => locationService.getHistory().goBack());

    await waitFor(() => expect(searchInput()).toHaveValue('cpu'));
    await waitFor(() => expect(backend.ruleSearches.at(-1)?.where).toEqual({ text: { value: 'cpu' } }));

    act(() => locationService.getHistory().goForward());

    await waitFor(() => expect(searchInput()).toHaveValue('plugins:hide cpu'));
    await waitFor(() =>
      expect(backend.ruleSearches.at(-1)?.where).toEqual({
        and: [
          { text: { value: 'cpu' } },
          { regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } },
        ],
      })
    );
  });
});

import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook } from 'test/test-utils';

import { type ComboboxOption } from '@grafana/ui';
import { AccessControlAction } from 'app/types/accessControl';
import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { setGrafanaPromRules, setPrometheusRules } from '../../../mocks/server/configure';
import { alertingFactory } from '../../../mocks/server/db';

import { useNamespaceAndGroupOptions } from './useRuleFilterAutocomplete';

const server = setupMswServer();

const GRAFANA_RULES_URL = '/api/prometheus/grafana/api/v1/rules';

// Mirrors GROUP_FETCH_LIMIT in useRuleFilterAutocomplete.ts (the per-source group fetch cap).
const GROUP_FETCH_LIMIT = 2000;

const wrapper = getWrapper({ renderWithRouter: true });

/**
 * Registers a handler for the Grafana Prometheus rules endpoint that filters by the
 * `search.rule_group` query parameter, mirroring the real backend's server-side search.
 * Returns the list of query strings the endpoint was called with so tests can assert
 * the request contract instead of internal hook arguments.
 */
function captureGrafanaGroupRequests(groups: GrafanaPromRuleGroupDTO[]) {
  const requests: URLSearchParams[] = [];

  server.use(
    http.get(GRAFANA_RULES_URL, ({ request }) => {
      const { searchParams } = new URL(request.url);
      requests.push(searchParams);

      const search = searchParams.get('search.rule_group')?.toLowerCase() ?? '';
      const filtered = search ? groups.filter((group) => group.name.toLowerCase().includes(search)) : groups;

      return HttpResponse.json({ status: 'success', data: { groups: filtered } });
    })
  );

  return requests;
}

/**
 * Awaits the option resolver inside `act` so the lazy-query state updates it triggers
 * are flushed within React's act() boundary (otherwise React logs act warnings).
 */
async function resolveOptions(resolver: () => Promise<Array<ComboboxOption<string>>>) {
  let options: Array<ComboboxOption<string>> = [];
  await act(async () => {
    options = await resolver();
  });
  return options;
}

function buildFolders(count: number): GrafanaPromRuleGroupDTO[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `g${i}`,
    file: `folder-${i}`,
    folderUid: `uid-${i}`,
    interval: 60,
    rules: [],
  }));
}

function buildExternalGroups(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `g${i}`,
    file: `namespace-${i}`,
    interval: 60,
    rules: [],
  }));
}

function buildExternalDataSource(uid: string) {
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
  return alertingFactory.dataSource.build({ name: uid, uid, jsonData: { manageAlerts: true } });
}

describe('useNamespaceAndGroupOptions', () => {
  afterEach(() => {
    // grantUserPermissions mutates global permission state; reset so tests can't leak
    // external-rules access into each other regardless of execution order.
    grantUserPermissions([]);
  });

  describe('namespaceOptions', () => {
    it('returns grafana folders as options, sorted, with a "Grafana folder" description', async () => {
      setGrafanaPromRules([
        { name: 'g1', file: 'folder-b', folderUid: 'b', interval: 60, rules: [] },
        { name: 'g2', file: 'folder-a', folderUid: 'a', interval: 60, rules: [] },
      ]);

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.namespaceOptions(''));

      expect(options).toEqual([
        { label: 'folder-a', value: 'folder-a', description: 'Grafana folder' },
        { label: 'folder-b', value: 'folder-b', description: 'Grafana folder' },
      ]);
    });

    it('returns all grafana folders without an info option, since they are searched server-side', async () => {
      // Grafana folders rely on server-side `search.folder`, so a large folder count no longer
      // suppresses autocomplete the way it does for external sources.
      setGrafanaPromRules(buildFolders(501));

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.namespaceOptions(''));

      expect(options).toHaveLength(501);
      expect(options.every((o) => o.description === 'Grafana folder')).toBe(true);
    });

    it.each([
      { groupCount: GROUP_FETCH_LIMIT + 1, expectInfoOption: true },
      { groupCount: GROUP_FETCH_LIMIT, expectInfoOption: false },
    ])(
      'shows the info option when an external page exceeds the group fetch limit (groups=$groupCount)',
      async ({ groupCount, expectInfoOption }) => {
        setGrafanaPromRules([]);
        const externalDs = buildExternalDataSource('mimir-threshold');
        setPrometheusRules(externalDs, buildExternalGroups(groupCount));

        const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

        const options = await resolveOptions(() => result.current.namespaceOptions(''));

        expect(options.some((o) => o.infoOption)).toBe(expectInfoOption);
      }
    );

    it('prepends the indicator but keeps the options we found when an external source is capped', async () => {
      setGrafanaPromRules([{ name: 'g1', file: 'folder-a', folderUid: 'a', interval: 60, rules: [] }]);
      const cappedDs = buildExternalDataSource('mimir-capped');
      // Many groups but all in a single namespace: exceeds the group cap yet collapses to one
      // namespace, exactly the case the group-based cap is a poor proxy for.
      const cappedGroups = Array.from({ length: GROUP_FETCH_LIMIT + 1 }, (_, i) => ({
        name: `g${i}`,
        file: 'big-namespace',
        interval: 60,
        rules: [],
      }));
      setPrometheusRules(cappedDs, cappedGroups);

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.namespaceOptions(''));

      // The indicator is surfaced at the top, with a warning icon...
      expect(options[0]).toEqual({
        label: 'Due to a large number of groups, search might not be complete in external data sources.',
        value: '__GRAFANA_INFO_OPTION__',
        infoOption: true,
        icon: 'exclamation-triangle',
      });
      // ...but the options we did find are retained, not discarded. External namespaces are
      // described by their data source.
      expect(options).toContainEqual({ label: 'folder-a', value: 'folder-a', description: 'Grafana folder' });
      expect(options).toContainEqual({ label: 'big-namespace', value: 'big-namespace', description: 'mimir-capped' });
    });

    it('silently degrades to external namespaces when the Grafana folder fetch fails', async () => {
      // A failing Grafana folder request must not discard the external namespace suggestions:
      // the two fetches degrade independently and the failure is swallowed.
      server.use(http.get(GRAFANA_RULES_URL, () => HttpResponse.json({}, { status: 500 })));
      const externalDs = buildExternalDataSource('mimir-ext');
      setPrometheusRules(externalDs, [{ name: 'g1', file: 'external-namespace', interval: 60, rules: [] }]);

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.namespaceOptions(''));

      // No Grafana folders (the fetch failed), but the external namespace is preserved.
      expect(options).toEqual([
        { label: 'external-namespace', value: 'external-namespace', description: 'mimir-ext' },
      ]);
    });

    it('formats external namespaces: yaml paths use the filename, long names are truncated, described by data source', async () => {
      // Isolate the external path: no Grafana folders.
      setGrafanaPromRules([]);
      const externalDs = buildExternalDataSource('mimir-ext');

      const longNamespace = 'x'.repeat(120);
      setPrometheusRules(externalDs, [
        { name: 'g1', file: '/etc/prometheus/rules/alerts.yml', interval: 60, rules: [] },
        { name: 'g2', file: longNamespace, interval: 60, rules: [] },
      ]);

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.namespaceOptions(''));

      // yaml path -> filename label; long plain name -> truncated label; description is the
      // data source name; sorted by label
      expect(options).toEqual([
        {
          label: 'alerts.yml',
          value: '/etc/prometheus/rules/alerts.yml',
          description: 'mimir-ext',
        },
        {
          label: `${longNamespace.substring(0, 47)}...`,
          value: longNamespace,
          description: 'mimir-ext',
        },
      ]);
    });

    it('describes a namespace shared across data sources as "Multiple data sources"', async () => {
      setGrafanaPromRules([]);
      const dsA = buildExternalDataSource('mimir-a');
      const dsB = buildExternalDataSource('mimir-b');
      setPrometheusRules(dsA, [{ name: 'g1', file: 'shared-namespace', interval: 60, rules: [] }]);
      setPrometheusRules(dsB, [{ name: 'g2', file: 'shared-namespace', interval: 60, rules: [] }]);

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.namespaceOptions(''));

      expect(options).toEqual([
        { label: 'shared-namespace', value: 'shared-namespace', description: 'Multiple data sources' },
      ]);
    });

    it('truncates a long data source name in the description', async () => {
      setGrafanaPromRules([]);
      const longName = 'd'.repeat(120);
      const externalDs = buildExternalDataSource(longName);
      setPrometheusRules(externalDs, [{ name: 'g1', file: 'ns', interval: 60, rules: [] }]);

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.namespaceOptions(''));

      expect(options).toEqual([{ label: 'ns', value: 'ns', description: `${longName.substring(0, 97)}...` }]);
    });

    it('should find a folder whose rule groups are outside the default group page', async () => {
      const requests: URLSearchParams[] = [];
      const allGroups: GrafanaPromRuleGroupDTO[] = [
        { name: 'g0', file: 'folder-a', folderUid: 'a', interval: 60, rules: [] },
        { name: 'g1', file: 'systems/authnz', folderUid: 'authnz-uid', interval: 60, rules: [] },
      ];
      server.use(
        http.get(GRAFANA_RULES_URL, ({ request }) => {
          const { searchParams } = new URL(request.url);
          requests.push(searchParams);
          const search = searchParams.get('search.folder')?.toLowerCase() ?? '';
          // Without a search term the backend returns the capped page
          const groups = search ? allGroups.filter((g) => g.file.toLowerCase().includes(search)) : [allGroups[0]];
          return HttpResponse.json({ status: 'success', data: { groups } });
        })
      );

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.namespaceOptions('authnz'));

      // the typed text is forwarded to the backend, and only matching folders come back
      expect(requests[0].get('search.folder')).toBe('authnz');
      expect(options).toEqual([{ label: 'systems/authnz', value: 'systems/authnz', description: 'Grafana folder' }]);
    });
  });

  describe('groupOptions', () => {
    it('should require minimum 3 characters before searching', async () => {
      const requests = captureGrafanaGroupRequests([]);

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.groupOptions('ab'));

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        label: 'Type at least 3 characters to search groups',
        value: '__GRAFANA_INFO_OPTION__',
        infoOption: true,
      });
      expect(requests).toHaveLength(0);
    });

    it('should search by group name when 3+ characters entered', async () => {
      const requests = captureGrafanaGroupRequests([
        { name: 'cpu-alerts', file: 'folder1', folderUid: 'uid1', interval: 60, rules: [] },
        { name: 'cpu-usage', file: 'folder2', folderUid: 'uid2', interval: 60, rules: [] },
        { name: 'memory-usage', file: 'folder3', folderUid: 'uid3', interval: 60, rules: [] },
      ]);

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.groupOptions('cpu'));

      expect(requests).toHaveLength(1);
      expect(requests[0].get('search.rule_group')).toBe('cpu');
      expect(requests[0].get('group_limit')).toBe('100');
      expect(requests[0].get('limit_alerts')).toBe('0');

      expect(options).toEqual([
        { label: 'cpu-alerts', value: 'cpu-alerts' },
        { label: 'cpu-usage', value: 'cpu-usage' },
      ]);
    });

    it('should show message when no groups match search', async () => {
      captureGrafanaGroupRequests([
        { name: 'cpu-alerts', file: 'folder1', folderUid: 'uid1', interval: 60, rules: [] },
      ]);

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.groupOptions('xyz123'));

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        label: 'No groups found matching "xyz123"',
        value: '__GRAFANA_INFO_OPTION__',
        infoOption: true,
      });
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      server.use(http.get(GRAFANA_RULES_URL, () => HttpResponse.json({}, { status: 500 })));

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.groupOptions('cpu'));

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        label: 'Error searching groups',
        value: '__GRAFANA_INFO_OPTION__',
        infoOption: true,
      });

      consoleErrorSpy.mockRestore();
    });
  });
});

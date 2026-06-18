import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook } from 'test/test-utils';

import { type ComboboxOption } from '@grafana/ui';
import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../../mockApi';
import { setGrafanaPromRules } from '../../../mocks/server/configure';

import { useNamespaceAndGroupOptions } from './useRuleFilterAutocomplete';

const server = setupMswServer();

const GRAFANA_RULES_URL = '/api/prometheus/grafana/api/v1/rules';

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

describe('useNamespaceAndGroupOptions', () => {
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

    it.skip('should find a folder whose rule groups are outside the default group page', async () => {
      // Backend that supports server-side folder search: the folder "systems/authnz"
      // only appears when `search.folder` is forwarded. The default (unfiltered) call is
      // capped and does NOT include it - mirroring an instance with more groups than the
      // group limit, where later folders never make it into the response.
      server.use(
        http.get(GRAFANA_RULES_URL, ({ request }) => {
          const { searchParams } = new URL(request.url);
          const searchFolder = searchParams.get('search.folder');

          const groups: GrafanaPromRuleGroupDTO[] = searchFolder
            ? [{ name: 'g1', file: 'systems/authnz', folderUid: 'authnz-uid', interval: 60, rules: [] }]
            : // Buggy path: unfiltered, capped page that never reaches systems/authnz
              [{ name: 'g0', file: 'folder-a', folderUid: 'a', interval: 60, rules: [] }];

          return HttpResponse.json({ status: 'success', data: { groups } });
        })
      );

      const { result } = renderHook(() => useNamespaceAndGroupOptions(), { wrapper });

      const options = await resolveOptions(() => result.current.namespaceOptions('authnz'));

      expect(options.map((o) => o.value)).toContain('systems/authnz');
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

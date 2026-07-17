import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';

import {
  buildRoutingParams,
  deriveDryRunResult,
  mergeTemplateFiles,
  parseDryRunResponse,
  readTemplateFiles,
  summarizeMergeStats,
  useDryRunNotifications,
  useImportNotifications,
} from './useImport';

const server = setupMswServer();

const CONVERT_URL = '/api/convert/api/v1/alerts';
const SAMPLE_YAML = ['route:', '  receiver: default', 'receivers:', '  - name: default', ''].join('\n');

function captureConvertHeaders() {
  const headers: Headers[] = [];
  server.use(
    http.post(CONVERT_URL, ({ request }) => {
      headers.push(request.headers);
      return HttpResponse.json({ status: 'success' });
    })
  );
  return headers;
}

function yamlFile() {
  return new File([SAMPLE_YAML], 'alertmanager.yaml', { type: 'application/yaml' });
}

const wrapper = getWrapper({ renderWithRouter: true });

describe('buildRoutingParams', () => {
  describe('when policy routing is enabled (feature flag ON)', () => {
    const usePolicyRouting = true;

    it('should return notificationSettings with policy when a routing tree is selected', () => {
      const result = buildRoutingParams('my-policy', usePolicyRouting);

      expect(result).toEqual({
        notificationSettings: JSON.stringify({ policy: 'my-policy' }),
      });
      expect(result).not.toHaveProperty('extraLabels');
    });

    it('should fall back to extraLabels=undefined when no routing tree is selected', () => {
      const result = buildRoutingParams(undefined, usePolicyRouting);

      expect(result).toEqual({ extraLabels: undefined });
      expect(result).not.toHaveProperty('notificationSettings');
    });

    it('should fall back to extraLabels=undefined for empty string routing tree', () => {
      const result = buildRoutingParams('', usePolicyRouting);

      expect(result).toEqual({ extraLabels: undefined });
      expect(result).not.toHaveProperty('notificationSettings');
    });
  });

  describe('when policy routing is disabled (feature flag OFF)', () => {
    const usePolicyRouting = false;

    it('should return extraLabels with the legacy label when a routing tree is selected', () => {
      const result = buildRoutingParams('my-policy', usePolicyRouting);

      expect(result).toEqual({
        extraLabels: '__grafana_managed_route__=my-policy',
      });
      expect(result).not.toHaveProperty('notificationSettings');
    });

    it('should return extraLabels=undefined when no routing tree is selected', () => {
      const result = buildRoutingParams(undefined, usePolicyRouting);

      expect(result).toEqual({ extraLabels: undefined });
      expect(result).not.toHaveProperty('notificationSettings');
    });

    it('should return extraLabels=undefined for empty string routing tree', () => {
      const result = buildRoutingParams('', usePolicyRouting);

      expect(result).toEqual({ extraLabels: undefined });
      expect(result).not.toHaveProperty('notificationSettings');
    });
  });
});

describe('summarizeMergeStats', () => {
  it('returns zero counts when there are no stats', () => {
    expect(summarizeMergeStats(undefined)).toEqual({
      route: false,
      receivers: 0,
      templates: 0,
      timeIntervals: 0,
      inhibitionRules: 0,
    });
  });

  it('counts each merged resource type and flags the route', () => {
    expect(
      summarizeMergeStats({
        added_route: 'imported-prod',
        added_receivers: ['slack', 'pagerduty'],
        added_templates: ['default'],
        added_time_intervals: ['business-hours', 'weekends', 'holidays'],
        added_inhibition_rules: ['mute-warnings'],
      })
    ).toEqual({
      route: true,
      receivers: 2,
      templates: 1,
      timeIntervals: 3,
      inhibitionRules: 1,
    });
  });
});

describe('parseDryRunResponse', () => {
  it('maps merge stats onto the validation result', () => {
    const result = parseDryRunResponse({
      status: 'success',
      stats: { added_receivers: ['slack'], added_route: 'imported-prod' },
    });

    expect(result.valid).toBe(true);
    expect(result.stats).toEqual({
      route: true,
      receivers: 1,
      templates: 0,
      timeIntervals: 0,
      inhibitionRules: 0,
    });
  });

  it('omits stats when the response has none', () => {
    const result = parseDryRunResponse({ status: 'success' });

    expect(result.stats).toBeUndefined();
  });
});

describe('deriveDryRunResult', () => {
  const validResult = {
    valid: true,
    error: undefined,
    renamedReceivers: [],
    renamedTimeIntervals: [],
    stats: undefined,
  };

  it('returns undefined when there is neither data nor error', () => {
    expect(deriveDryRunResult(undefined, undefined)).toBeUndefined();
  });

  it('returns the successful result when there is no error', () => {
    expect(deriveDryRunResult(validResult, undefined)).toBe(validResult);
  });

  it('returns an invalid result carrying the error when only an error is present', () => {
    expect(deriveDryRunResult(undefined, 'boom')).toMatchObject({ valid: false, error: 'boom' });
  });

  // Regression: a pre-run failure (e.g. a template conflict) sets an error while the previous
  // successful dry-run response is still cached. The error must win over the stale data, or the
  // review step reports the config as ready to import.
  it('prioritizes the error over stale successful data', () => {
    const result = deriveDryRunResult(validResult, 'duplicate template "dupe.tmpl"');

    expect(result?.valid).toBe(false);
    expect(result?.error).toBe('duplicate template "dupe.tmpl"');
  });
});

describe('promote header wiring', () => {
  it('sends X-Grafana-Alerting-Promote when importing with promote', async () => {
    const headers = captureConvertHeaders();
    const { result } = renderHook(() => useImportNotifications(), { wrapper });

    await act(async () => {
      await result.current({ source: 'yaml', yamlFile: yamlFile(), configIdentifier: 'prod', promote: true });
    });

    expect(headers).toHaveLength(1);
    expect(headers[0].get('X-Grafana-Alerting-Promote')).toBe('true');
  });

  it('omits the promote header when staging (no promote)', async () => {
    const headers = captureConvertHeaders();
    const { result } = renderHook(() => useImportNotifications(), { wrapper });

    await act(async () => {
      await result.current({ source: 'yaml', yamlFile: yamlFile(), configIdentifier: 'prod' });
    });

    expect(headers).toHaveLength(1);
    expect(headers[0].has('X-Grafana-Alerting-Promote')).toBe(false);
  });

  it('sends the promote header on a promote dry-run', async () => {
    const headers = captureConvertHeaders();
    const { result } = renderHook(() => useDryRunNotifications(), { wrapper });

    await act(async () => {
      await result.current.runDryRun({ source: 'yaml', yamlFile: yamlFile(), configIdentifier: 'prod', promote: true });
    });

    expect(headers).toHaveLength(1);
    expect(headers[0].get('X-Grafana-Alerting-Promote')).toBe('true');
    expect(headers[0].get('X-Grafana-Alerting-Dry-Run')).toBe('true');
  });
});

describe('useDryRunNotifications reset', () => {
  // Regression: once a dry-run succeeds, its result is cached. If the step later becomes invalid
  // (e.g. a duplicate template name) the dry-run stops running, so reset() must clear the cached
  // result or the review step keeps reporting the config as ready to import.
  it('clears a previous successful result', async () => {
    server.use(http.post(CONVERT_URL, () => HttpResponse.json({ status: 'success' })));
    const { result } = renderHook(() => useDryRunNotifications(), { wrapper });

    await act(async () => {
      await result.current.runDryRun({ source: 'yaml', yamlFile: yamlFile(), configIdentifier: 'prod' });
    });
    await waitFor(() => expect(result.current.result?.valid).toBe(true));

    act(() => {
      result.current.reset();
    });
    await waitFor(() => expect(result.current.result).toBeUndefined());
  });

  // Regression: the Step 1 trigger effect depends on runDryRun/reset identity. RTK recreates the
  // mutation's reset on every trigger, so if reset isn't stabilized its identity changes after each
  // dry-run, re-firing that effect and triggering another dry-run — an infinite request loop.
  it('keeps stable runDryRun and reset identities across a dry-run', async () => {
    server.use(http.post(CONVERT_URL, () => HttpResponse.json({ status: 'success' })));
    const { result } = renderHook(() => useDryRunNotifications(), { wrapper });

    const runDryRunBefore = result.current.runDryRun;
    const resetBefore = result.current.reset;

    await act(async () => {
      await result.current.runDryRun({ source: 'yaml', yamlFile: yamlFile(), configIdentifier: 'prod' });
    });
    await waitFor(() => expect(result.current.result?.valid).toBe(true));

    expect(result.current.runDryRun).toBe(runDryRunBefore);
    expect(result.current.reset).toBe(resetBefore);
  });
});

function templateFile(name: string, content: string) {
  return new File([content], name, { type: 'text/plain' });
}

describe('readTemplateFiles', () => {
  it('returns an empty map when there are no files', async () => {
    expect(await readTemplateFiles()).toEqual({});
    expect(await readTemplateFiles([])).toEqual({});
  });

  it('keys each file by its name with the file content as the value', async () => {
    const result = await readTemplateFiles([
      templateFile('email.tmpl', 'email body'),
      templateFile('slack.tmpl', 'slack body'),
    ]);

    expect(result).toEqual({ 'email.tmpl': 'email body', 'slack.tmpl': 'slack body' });
  });

  it('rejects when two files share the same name', async () => {
    await expect(
      readTemplateFiles([templateFile('dupe.tmpl', 'one'), templateFile('dupe.tmpl', 'two')])
    ).rejects.toThrow('dupe.tmpl');
  });
});

describe('mergeTemplateFiles', () => {
  it('layers uploaded templates on top of the embedded ones', () => {
    expect(mergeTemplateFiles({ 'embedded.tmpl': 'a' }, { 'uploaded.tmpl': 'b' })).toEqual({
      'embedded.tmpl': 'a',
      'uploaded.tmpl': 'b',
    });
  });

  it('returns a copy of the embedded map when there are no uploaded templates', () => {
    const embedded = { 'embedded.tmpl': 'a' };
    const merged = mergeTemplateFiles(embedded, {});

    expect(merged).toEqual(embedded);
    expect(merged).not.toBe(embedded);
  });

  it('throws when an uploaded name collides with an embedded template', () => {
    expect(() => mergeTemplateFiles({ 'shared.tmpl': 'embedded' }, { 'shared.tmpl': 'uploaded' })).toThrow(
      'shared.tmpl'
    );
  });
});

describe('template file import wiring', () => {
  function captureConvertBodies() {
    const bodies: Array<{ alertmanager_config: string; template_files: Record<string, string> }> = [];
    server.use(
      http.post(CONVERT_URL, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json({ status: 'success' });
      })
    );
    return bodies;
  }

  it('combines separately-uploaded template files into the request template_files map', async () => {
    const bodies = captureConvertBodies();
    const { result } = renderHook(() => useImportNotifications(), { wrapper });

    await act(async () => {
      await result.current({
        source: 'yaml',
        yamlFile: yamlFile(),
        templateFiles: [templateFile('email.tmpl', 'email body'), templateFile('slack.tmpl', 'slack body')],
        configIdentifier: 'prod',
      });
    });

    expect(bodies).toHaveLength(1);
    expect(bodies[0].template_files).toEqual({ 'email.tmpl': 'email body', 'slack.tmpl': 'slack body' });
  });

  it('surfaces a duplicate-template error and does not call the API', async () => {
    const bodies = captureConvertBodies();
    const { result } = renderHook(() => useImportNotifications(), { wrapper });

    await expect(
      act(async () => {
        await result.current({
          source: 'yaml',
          yamlFile: yamlFile(),
          templateFiles: [templateFile('dupe.tmpl', 'one'), templateFile('dupe.tmpl', 'two')],
          configIdentifier: 'prod',
        });
      })
    ).rejects.toThrow('dupe.tmpl');

    expect(bodies).toHaveLength(0);
  });
});

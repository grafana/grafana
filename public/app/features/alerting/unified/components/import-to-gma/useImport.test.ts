import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook } from 'test/test-utils';

import { DEFAULT_ROUTING_TREE_NAME_ALIAS } from '@grafana/alerting';

import { setupMswServer } from '../../mockApi';
import { mockGrafanaRulerRule, mockRulerAlertingRule } from '../../mocks';
import { convertResponse } from '../../mocks/convertApi';
import { ROOT_ROUTE_NAME } from '../../utils/k8s/constants';

import {
  buildRoutingParams,
  deriveDryRunResult,
  deriveDryRunState,
  filterRulerRulesConfig,
  parseDryRunResponse,
  summarizeMergeStats,
  useImportNotifications,
  useImportRules,
} from './useImport';

const server = setupMswServer();

const CONVERT_URL = '/api/convert/api/v1/alerts';
const SAMPLE_YAML = ['route:', '  receiver: default', 'receivers:', '  - name: default', ''].join('\n');

function captureConvertHeaders() {
  const headers: Headers[] = [];
  server.use(
    http.post(CONVERT_URL, ({ request }) => {
      headers.push(request.headers);
      return HttpResponse.json(convertResponse());
    })
  );
  return headers;
}

function yamlFile() {
  return new File([SAMPLE_YAML], 'alertmanager.yaml', { type: 'application/yaml' });
}

const wrapper = getWrapper({ renderWithRouter: true });

describe('buildRoutingParams', () => {
  it('should return the named routing tree when one is selected', () => {
    const result = buildRoutingParams('my-policy');

    expect(result).toEqual({
      notificationSettings: { type: 'NamedRoutingTree', routingTree: 'my-policy' },
    });
  });

  it('should return notificationSettings=null when no routing tree is selected', () => {
    const result = buildRoutingParams(undefined);

    expect(result).toEqual({ notificationSettings: null });
  });

  it('should return notificationSettings=null for empty string routing tree', () => {
    const result = buildRoutingParams('');

    expect(result).toEqual({ notificationSettings: null });
  });

  it('should return notificationSettings=null for the default routing tree', () => {
    const result = buildRoutingParams(ROOT_ROUTE_NAME);

    expect(result).toEqual({ notificationSettings: null });
  });

  it('should return notificationSettings=null for the default routing tree alias', () => {
    const result = buildRoutingParams(DEFAULT_ROUTING_TREE_NAME_ALIAS);

    expect(result).toEqual({ notificationSettings: null });
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
      errorType: '',
      error: '',
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
    const result = parseDryRunResponse({ status: 'success', errorType: '', error: '' });

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

describe('deriveDryRunState', () => {
  const validResult = {
    valid: true,
    error: undefined,
    renamedReceivers: [],
    renamedTimeIntervals: [],
    stats: undefined,
  };
  const renamedResult = {
    valid: true,
    error: undefined,
    renamedReceivers: [{ originalName: 'default', newName: 'default-2' }],
    renamedTimeIntervals: [],
    stats: undefined,
  };
  const invalidResult = {
    valid: false,
    error: 'boom',
    renamedReceivers: [],
    renamedTimeIntervals: [],
    stats: undefined,
  };

  it('is loading whenever the mutation is loading, regardless of stale result or error', () => {
    expect(deriveDryRunState(true, undefined, undefined)).toBe('loading');
    expect(deriveDryRunState(true, validResult, undefined)).toBe('loading');
    expect(deriveDryRunState(true, undefined, 'boom')).toBe('loading');
  });

  it('is idle when there is neither a result nor an error', () => {
    expect(deriveDryRunState(false, undefined, undefined)).toBe('idle');
  });

  it('is success for a valid result with no renamed resources', () => {
    expect(deriveDryRunState(false, validResult, undefined)).toBe('success');
  });

  it('is warning for a valid result that renamed resources', () => {
    expect(deriveDryRunState(false, renamedResult, undefined)).toBe('warning');
  });

  it('is error for an invalid result', () => {
    expect(deriveDryRunState(false, invalidResult, undefined)).toBe('error');
  });

  // Regression: the same stale-result precedence deriveDryRunResult guards against — an error
  // must win even if a previous successful result is still sitting in `result`.
  it('is error when an error is present alongside a stale successful result', () => {
    expect(deriveDryRunState(false, validResult, 'boom')).toBe('error');
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
});

function templateFile(name: string, content: string) {
  return new File([content], name, { type: 'text/plain' });
}

describe('template file import wiring', () => {
  function captureConvertBodies() {
    const bodies: Array<{ alertmanager_config: string; template_files: Record<string, string> }> = [];
    server.use(
      http.post(CONVERT_URL, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json(convertResponse());
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

    // The rejection is checked inside `act`: an `act` call that rejects leaves React's test renderer
    // broken, and every hook rendered after it in this file returns nothing.
    await act(async () => {
      await expect(
        result.current({
          source: 'yaml',
          yamlFile: yamlFile(),
          templateFiles: [templateFile('dupe.tmpl', 'one'), templateFile('dupe.tmpl', 'two')],
          configIdentifier: 'prod',
        })
      ).rejects.toThrow('dupe.tmpl');
    });

    expect(bodies).toHaveLength(0);
  });
});

describe('rules import wiring', () => {
  const RULES_URL = '/api/convert/prometheus/config/v1/rules';

  function captureRulesRequests() {
    const requests: Array<{ headers: Headers; body: unknown }> = [];
    server.use(
      http.post(RULES_URL, async ({ request }) => {
        requests.push({ headers: request.headers, body: await request.json() });
        return HttpResponse.json(convertResponse());
      })
    );
    return requests;
  }

  it('sends the import options as headers, with the routing tree in the convert API shape', async () => {
    const requests = captureRulesRequests();
    const { result } = renderHook(() => useImportRules(), { wrapper });

    await act(async () => {
      await result.current({
        dataSourceUID: 'mimir',
        targetFolderUID: 'folder-1',
        pauseAlertingRules: true,
        pauseRecordingRules: false,
        payload: {},
        targetDatasourceUID: 'mimir-writes',
        ...buildRoutingParams('team-a'),
      });
    });

    expect(requests).toHaveLength(1);
    const { headers } = requests[0];
    expect(headers.get('X-Grafana-Alerting-Datasource-UID')).toBe('mimir');
    expect(headers.get('X-Grafana-Alerting-Folder-UID')).toBe('folder-1');
    expect(headers.get('X-Grafana-Alerting-Target-Datasource-UID')).toBe('mimir-writes');
    expect(headers.get('X-Grafana-Alerting-Alert-Rules-Paused')).toBe('true');
    expect(headers.get('X-Grafana-Alerting-Recording-Rules-Paused')).toBe('false');
    expect(headers.get('X-Grafana-Alerting-Notification-Settings')).toBe(JSON.stringify({ policy: 'team-a' }));
    // The imported rules stay editable in the UI.
    expect(headers.has('X-Disable-Provenance')).toBe(true);
  });

  it('leaves out the notification settings header for the default routing tree', async () => {
    const requests = captureRulesRequests();
    const { result } = renderHook(() => useImportRules(), { wrapper });

    await act(async () => {
      await result.current({
        dataSourceUID: 'mimir',
        pauseAlertingRules: false,
        pauseRecordingRules: false,
        payload: {},
        ...buildRoutingParams(undefined),
      });
    });

    expect(requests[0].headers.has('X-Grafana-Alerting-Notification-Settings')).toBe(false);
  });
});

describe('filterRulerRulesConfig', () => {
  it('skips Grafana-managed rules, since the convert API only imports data source rules', () => {
    const dataSourceRule = mockRulerAlertingRule({ alert: 'HighCPU' });

    const result = filterRulerRulesConfig({ ns: [{ name: 'group', rules: [dataSourceRule, mockGrafanaRulerRule()] }] });

    expect(result).toEqual({
      filteredConfig: { ns: [{ name: 'group', rules: [dataSourceRule] }] },
      someRulesAreSkipped: true,
    });
  });
});

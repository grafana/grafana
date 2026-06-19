import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';

import {
  buildRoutingParams,
  parseDryRunResponse,
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

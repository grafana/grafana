import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';
import { type GrafanaPromRuleGroupDTO, type Labels } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../mockApi';
import { mockGrafanaPromAlertingRule, mockGrafanaPromRuleGroup } from '../mocks';

import { alertingApi } from './alertingApi';
import { prometheusApi, toRuleLabels } from './prometheusApi';

const server = setupMswServer();

const GRAFANA_RULES_URL = '/api/prometheus/grafana/api/v1/rules';

function groupWithRuleLabels(...ruleLabels: Array<Labels | undefined>): GrafanaPromRuleGroupDTO {
  return mockGrafanaPromRuleGroup({ rules: ruleLabels.map((labels) => mockGrafanaPromAlertingRule({ labels })) });
}

function rulesResponse(...groups: GrafanaPromRuleGroupDTO[]) {
  return { status: 'success', data: { groups } };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('toRuleLabels', () => {
  it('lists each label once, however many rules and groups set it', () => {
    const response = rulesResponse(
      groupWithRuleLabels({ team: 'platform', severity: 'critical' }, undefined),
      groupWithRuleLabels({ team: 'platform', severity: 'warning' })
    );

    expect(toRuleLabels(response)).toEqual([
      { key: 'team', value: 'platform' },
      { key: 'severity', value: 'critical' },
      { key: 'severity', value: 'warning' },
    ]);
  });

  it.each<{ case: string; labels: Labels }>([
    {
      // A `__` prefix is enough to be internal, without the `__` suffix too.
      case: 'internal keys',
      labels: { __grafana_origin: 'plugin/grafana-slo-app', __grafana_origin_uid: 'slo-1' },
    },
    { case: 'templated values', labels: { team: '{{ $labels.team }}', env: 'prod-{{ $labels.region }}' } },
    { case: 'blank values', labels: { team: '', owner: '  ' } },
  ])('leaves out $case', ({ labels }) => {
    expect(toRuleLabels(rulesResponse(groupWithRuleLabels(labels)))).toEqual([]);
  });
});

describe('getGrafanaRuleLabels', () => {
  it('asks only for alerting rules, without their alert instances or queries', async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(GRAFANA_RULES_URL, ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json(rulesResponse(groupWithRuleLabels({ team: 'platform' })));
      })
    );

    const { result } = renderHook(() => prometheusApi.useGetGrafanaRuleLabelsQuery(), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.data).toEqual([{ key: 'team', value: 'platform' }]));
    expect(requests.map((params) => Object.fromEntries(params))).toEqual([
      { rule_type: 'alerting', limit_alerts: '0', compact: 'true' },
    ]);
  });

  it('refetches when alert rule tags are invalidated, despite the long cache', async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(GRAFANA_RULES_URL, ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json(rulesResponse());
      })
    );
    const store = configureStore();

    const { result } = renderHook(() => prometheusApi.useGetGrafanaRuleLabelsQuery(), {
      wrapper: getWrapper({ store }),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // What both rule save paths (ruler and app platform) invalidate.
    act(() => {
      store.dispatch(alertingApi.util.invalidateTags(['CombinedAlertRule']));
    });

    await waitFor(() => expect(requests).toHaveLength(2));
  });

  it('turns off the error toast for its request, since callers treat the labels as optional', async () => {
    const fetch = jest.spyOn(backendSrv, 'fetch');
    server.use(http.get(GRAFANA_RULES_URL, () => HttpResponse.json({ message: 'Rules unavailable' }, { status: 500 })));

    const { result } = renderHook(() => prometheusApi.useGetGrafanaRuleLabelsQuery(), { wrapper: getWrapper({}) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'api/prometheus/grafana/api/v1/rules', showErrorAlert: false })
    );
  });
});

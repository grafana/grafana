import { type GrafanaRuleIdentifier, type PrometheusRuleIdentifier } from 'app/types/unified-alerting';

import { RuleFormType } from '../types/rule-form';

import { resolveRuleEditorRouting } from './ruleEditorRouting';

type RoutingInput = Parameters<typeof resolveRuleEditorRouting>[0];
type RoutingRequest = Omit<RoutingInput, 'access'>;
type RuleEditorAccess = RoutingInput['access'];

const grafanaIdentifier: GrafanaRuleIdentifier = { ruleSourceName: 'grafana', uid: 'rule-uid' };
const prometheusIdentifier: PrometheusRuleIdentifier = {
  ruleSourceName: 'Prometheus',
  namespace: 'namespace',
  groupName: 'group',
  ruleName: 'rule',
  ruleHash: 'hash',
};

function makeAccess(overrides: Partial<RuleEditorAccess> = {}): RuleEditorAccess {
  return {
    canCreateGrafanaRules: false,
    canCreateCloudRules: false,
    canCreateDataSourceRules: false,
    canEditRules: () => false,
    ...overrides,
  };
}

const grafanaOnly = makeAccess({
  canCreateGrafanaRules: true,
  canEditRules: (ruleSourceName) => ruleSourceName === 'grafana',
});
const externalOnly = makeAccess({
  canCreateCloudRules: true,
  canCreateDataSourceRules: true,
  canEditRules: (ruleSourceName) => ruleSourceName !== 'grafana',
});
const externalWriteWithoutDataSourcesRead = makeAccess({ canCreateDataSourceRules: true });
const fullAccess = makeAccess({
  canCreateGrafanaRules: true,
  canCreateCloudRules: true,
  canCreateDataSourceRules: true,
  canEditRules: () => true,
});

describe('resolveRuleEditorRouting', () => {
  const deniedRequests: Array<{
    name: string;
    request: RoutingRequest;
    access: RuleEditorAccess;
    refusal: 'refused-create' | 'refused-edit';
  }> = [
    {
      name: 'creation without access',
      request: { routeType: 'recording' },
      access: makeAccess(),
      refusal: 'refused-create',
    },
    {
      name: 'editing a data source-managed rule without external write',
      request: { identifier: prometheusIdentifier },
      access: grafanaOnly,
      refusal: 'refused-edit',
    },
    {
      name: 'editing a Grafana rule without Grafana write',
      request: { identifier: grafanaIdentifier },
      access: externalOnly,
      refusal: 'refused-edit',
    },
    {
      name: 'explicit data source-managed creation without external write',
      request: { routeType: 'recording' },
      access: grafanaOnly,
      refusal: 'refused-create',
    },
    {
      name: 'prefilled data source-managed creation without external write',
      request: { prefillType: RuleFormType.cloudAlerting },
      access: grafanaOnly,
      refusal: 'refused-create',
    },
    {
      name: 'cloning a data source-managed rule without external write',
      request: { cloneIdentifier: prometheusIdentifier },
      access: grafanaOnly,
      refusal: 'refused-create',
    },
    {
      name: 'cloning a Grafana rule without Grafana create access',
      request: { cloneIdentifier: grafanaIdentifier },
      access: externalOnly,
      refusal: 'refused-create',
    },
  ];

  it.each(deniedRequests)('refuses $name and withholds the handoff', ({ request, access, refusal }) => {
    expect(resolveRuleEditorRouting({ ...request, access })).toEqual({ grafanaPage: { kind: refusal } });
  });

  it('hands off editing a data source-managed rule', () => {
    expect(resolveRuleEditorRouting({ identifier: prometheusIdentifier, access: fullAccess })).toEqual({
      grafanaPage: { kind: 'edit', identifier: prometheusIdentifier },
      pluginHandoff: { action: 'edit', identifier: prometheusIdentifier },
    });
  });

  it('hands off cloning a data source-managed rule', () => {
    expect(resolveRuleEditorRouting({ cloneIdentifier: prometheusIdentifier, access: fullAccess })).toEqual({
      grafanaPage: { kind: 'clone', identifier: prometheusIdentifier },
      pluginHandoff: { action: 'clone', identifier: prometheusIdentifier },
    });
  });

  it.each([
    { case: 'the recording route', routeType: 'recording' as const, expected: 'recording' },
    { case: 'a prefilled recording rule', prefillType: RuleFormType.cloudRecording, expected: 'recording' },
    { case: 'a prefilled alerting rule', prefillType: RuleFormType.cloudAlerting, expected: 'alerting' },
  ])('hands off creation from $case as $expected', ({ routeType, prefillType, expected }) => {
    const routing = resolveRuleEditorRouting({ routeType, prefillType, access: fullAccess });

    expect(routing.pluginHandoff).toEqual({ action: 'create', ruleType: expected });
  });

  it('hands off creation for a user who can only create data source-managed rules', () => {
    const routing = resolveRuleEditorRouting({ access: externalOnly });

    expect(routing.grafanaPage).toEqual({ kind: 'create' });
    expect(routing.pluginHandoff).toEqual({ action: 'create', ruleType: 'alerting' });
  });

  it("hands off to the plugin when only Grafana's data source visibility check fails", () => {
    expect(resolveRuleEditorRouting({ routeType: 'recording', access: externalWriteWithoutDataSourcesRead })).toEqual({
      grafanaPage: { kind: 'refused-create' },
      pluginHandoff: { action: 'create', ruleType: 'recording' },
    });
  });

  it("renders Grafana's page when it can offer a data source", () => {
    const routing = resolveRuleEditorRouting({ routeType: 'recording', access: externalOnly });

    expect(routing.grafanaPage).toEqual({ kind: 'create' });
  });

  it.each([
    { case: 'editing a Grafana rule', request: { identifier: grafanaIdentifier } },
    { case: 'cloning a Grafana rule', request: { cloneIdentifier: grafanaIdentifier } },
    { case: 'creating a Grafana rule', request: {} },
    { case: 'creating a Grafana recording rule', request: { routeType: 'grafana-recording' as const } },
    { case: 'a prefilled Grafana rule', request: { prefillType: RuleFormType.grafana } },
  ])('does not hand off when $case', ({ request }) => {
    const routing = resolveRuleEditorRouting({ ...request, access: fullAccess });

    expect(routing.pluginHandoff).toBeUndefined();
  });
});

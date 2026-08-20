import {
  type CloudRuleIdentifier,
  type GrafanaRuleIdentifier,
  type PrometheusRuleIdentifier,
} from 'app/types/unified-alerting';

import { RuleFormType } from '../types/rule-form';

import { resolveRuleEditorRouting } from './ruleEditorRouting';

const grafanaIdentifier: GrafanaRuleIdentifier = { ruleSourceName: 'grafana', uid: 'rule-uid' };

const prometheusIdentifier: PrometheusRuleIdentifier = {
  ruleSourceName: 'Prometheus',
  namespace: 'namespace',
  groupName: 'group',
  ruleName: 'rule',
  ruleHash: 'hash',
};

const cloudIdentifier: CloudRuleIdentifier = {
  ruleSourceName: 'Mimir',
  namespace: 'namespace',
  groupName: 'group',
  ruleName: 'rule',
  rulerRuleHash: 'hash',
};

/** Grafana rules only: no external write at all. */
const grafanaOnly = {
  canCreateGrafanaRules: true,
  canCreateCloudRules: false,
  canCreateDataSourceRules: false,
  canEditRules: (ruleSourceName: string) => ruleSourceName === 'grafana',
};

/** Data source-managed rules only, e.g. an operator without folder access. */
const externalOnly = {
  canCreateGrafanaRules: false,
  canCreateCloudRules: true,
  canCreateDataSourceRules: true,
  canEditRules: (ruleSourceName: string) => ruleSourceName !== 'grafana',
};

/**
 * Has external write but not DataSourcesRead, so Grafana's own form cannot offer a data source
 * while the plugin — which brings its own form — still can.
 */
const externalWriteWithoutDataSourcesRead = {
  ...externalOnly,
  canCreateCloudRules: false,
  canCreateDataSourceRules: true,
};

const fullAccess = {
  canCreateGrafanaRules: true,
  canCreateCloudRules: true,
  canCreateDataSourceRules: true,
  canEditRules: () => true,
};

const noAccess = {
  canCreateGrafanaRules: false,
  canCreateCloudRules: false,
  canCreateDataSourceRules: false,
  canEditRules: () => false,
};

describe('resolveRuleEditorRouting', () => {
  describe('refuses, and withholds the handoff, when the user may not make the request', () => {
    it('refuses creation when the user can create neither kind of rule', () => {
      const routing = resolveRuleEditorRouting({ routeType: 'recording', access: noAccess });

      expect(routing.grafanaPage).toEqual({ kind: 'refused-create' });
      expect(routing.pluginHandoff).toBeUndefined();
    });

    it.each([
      { name: 'Prometheus', identifier: prometheusIdentifier },
      { name: 'Cloud', identifier: cloudIdentifier },
    ])('refuses editing a $name rule without external write', ({ identifier }) => {
      const routing = resolveRuleEditorRouting({ identifier, access: grafanaOnly });

      expect(routing.grafanaPage).toEqual({ kind: 'refused-edit' });
      expect(routing.pluginHandoff).toBeUndefined();
    });

    it('refuses editing a Grafana rule without Grafana write access', () => {
      const routing = resolveRuleEditorRouting({ identifier: grafanaIdentifier, access: externalOnly });

      expect(routing.grafanaPage).toEqual({ kind: 'refused-edit' });
      expect(routing.pluginHandoff).toBeUndefined();
    });

    it('refuses explicit data source-managed creation without external write', () => {
      const routing = resolveRuleEditorRouting({ routeType: 'recording', access: grafanaOnly });

      expect(routing.grafanaPage).toEqual({ kind: 'refused-create' });
      expect(routing.pluginHandoff).toBeUndefined();
    });

    it('refuses a prefilled data source-managed rule without external write', () => {
      const routing = resolveRuleEditorRouting({ prefillType: RuleFormType.cloudAlerting, access: grafanaOnly });

      expect(routing.grafanaPage).toEqual({ kind: 'refused-create' });
      expect(routing.pluginHandoff).toBeUndefined();
    });

    it('refuses cloning a data source-managed rule without external write', () => {
      const routing = resolveRuleEditorRouting({ cloneIdentifier: prometheusIdentifier, access: grafanaOnly });

      expect(routing.grafanaPage).toEqual({ kind: 'refused-create' });
      expect(routing.pluginHandoff).toBeUndefined();
    });

    it('refuses cloning a Grafana rule without Grafana create access', () => {
      const routing = resolveRuleEditorRouting({ cloneIdentifier: grafanaIdentifier, access: externalOnly });

      expect(routing.grafanaPage).toEqual({ kind: 'refused-create' });
      expect(routing.pluginHandoff).toBeUndefined();
    });
  });

  describe('hands off to the plugin when the user is allowed', () => {
    it.each([
      { name: 'Prometheus', identifier: prometheusIdentifier },
      { name: 'Cloud', identifier: cloudIdentifier },
    ])('hands off editing a $name rule', ({ identifier }) => {
      const routing = resolveRuleEditorRouting({ identifier, access: fullAccess });

      expect(routing.grafanaPage).toEqual({ kind: 'edit', identifier });
      expect(routing.pluginHandoff).toEqual({ action: 'edit', identifier });
    });

    it('hands off cloning a data source-managed rule', () => {
      const routing = resolveRuleEditorRouting({ cloneIdentifier: prometheusIdentifier, access: fullAccess });

      expect(routing.grafanaPage).toEqual({ kind: 'clone', identifier: prometheusIdentifier });
      expect(routing.pluginHandoff).toEqual({ action: 'clone', identifier: prometheusIdentifier });
    });

    it.each([
      { case: 'the recording route', routeType: 'recording' as const, expected: 'recording' },
      { case: 'a prefilled cloud recording rule', prefillType: RuleFormType.cloudRecording, expected: 'recording' },
      { case: 'a prefilled cloud alerting rule', prefillType: RuleFormType.cloudAlerting, expected: 'alerting' },
    ])('hands off creation from $case as $expected', ({ routeType, prefillType, expected }) => {
      const routing = resolveRuleEditorRouting({ routeType, prefillType, access: fullAccess });

      expect(routing.pluginHandoff).toEqual({ action: 'create', ruleType: expected });
    });

    it('hands off creation for a user who can only create data source-managed rules', () => {
      const routing = resolveRuleEditorRouting({ access: externalOnly });

      expect(routing.grafanaPage).toEqual({ kind: 'create' });
      expect(routing.pluginHandoff).toEqual({ action: 'create', ruleType: 'alerting' });
    });
  });

  describe('separates permission to make the request from Grafana being able to carry it out', () => {
    it('still hands off when only Grafana form feasibility is missing', () => {
      const routing = resolveRuleEditorRouting({
        routeType: 'recording',
        access: externalWriteWithoutDataSourcesRead,
      });

      expect(routing.pluginHandoff).toEqual({ action: 'create', ruleType: 'recording' });
    });

    it("refuses Grafana's own page when it cannot offer a data source", () => {
      const routing = resolveRuleEditorRouting({
        routeType: 'recording',
        access: externalWriteWithoutDataSourcesRead,
      });

      expect(routing.grafanaPage).toEqual({ kind: 'refused-create' });
    });

    it("renders Grafana's page when it can offer a data source", () => {
      const routing = resolveRuleEditorRouting({ routeType: 'recording', access: externalOnly });

      expect(routing.grafanaPage).toEqual({ kind: 'create' });
    });
  });

  describe('leaves Grafana-managed requests alone', () => {
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
});

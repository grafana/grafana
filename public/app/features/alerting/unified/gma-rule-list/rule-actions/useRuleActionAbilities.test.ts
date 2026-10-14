import { renderHook } from 'test/test-utils';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { useRuleActionAbilities } from './useRuleActionAbilities';

function buildRule(annotations: Record<string, string> = {}, labels: Record<string, string> = {}): AlertRule {
  return {
    apiVersion: 'v0alpha1',
    kind: 'AlertRule',
    metadata: { name: 'rule-uid-1', annotations },
    spec: {
      title: 'My rule',
      labels,
      execErrState: 'Alerting',
      noDataState: 'NoData',
      trigger: { interval: '1m' },
      expressions: {},
    },
  };
}

function loaded(rule: AlertRule): RuleResourceState<AlertRule> {
  return { status: 'loaded', rule };
}

describe('useRuleActionAbilities', () => {
  beforeEach(() => {
    grantUserPermissions([]);
  });

  it('STATE-2: makes edit/pause/delete/duplicate unavailable while the resource is loading', () => {
    const { result } = renderHook(() => useRuleActionAbilities({ status: 'loading' }));

    expect(result.current.edit.available).toBe(false);
    expect(result.current.pause.available).toBe(false);
    expect(result.current.delete.available).toBe(false);
    expect(result.current.duplicate.available).toBe(false);
  });

  it('STATE-2: makes edit/pause/delete/duplicate unavailable when the resource failed to load', () => {
    const { result } = renderHook(() => useRuleActionAbilities({ status: 'error' }));

    expect(result.current.edit.available).toBe(false);
    expect(result.current.delete.available).toBe(false);
  });

  it('STATE-2: grants edit only when canWrite is the exact string "true"', () => {
    const { result } = renderHook(() =>
      useRuleActionAbilities(loaded(buildRule({ 'grafana.com/access/canWrite': 'true' })))
    );

    expect(result.current.edit).toEqual({ available: true });
  });

  it('STATE-2: treats a missing canWrite annotation as unknown, not denied, with a distinct reason', () => {
    const { result } = renderHook(() => useRuleActionAbilities(loaded(buildRule({}))));

    expect(result.current.edit.available).toBe(false);
    expect(result.current.edit.reason).toBe('Permission unknown');
  });

  it('STATE-2: denies edit when canWrite is present but not "true"', () => {
    const { result } = renderHook(() =>
      useRuleActionAbilities(loaded(buildRule({ 'grafana.com/access/canWrite': 'false' })))
    );

    expect(result.current.edit.available).toBe(false);
    expect(result.current.edit.reason).toBe('You do not have permission to do this');
  });

  it('makes delete independent of the canWrite annotation, gated on canDelete instead', () => {
    const { result } = renderHook(() =>
      useRuleActionAbilities(
        loaded(buildRule({ 'grafana.com/access/canWrite': 'true', 'grafana.com/access/canDelete': 'false' }))
      )
    );

    expect(result.current.edit).toEqual({ available: true });
    expect(result.current.delete.available).toBe(false);
  });

  it('makes edit/pause/delete unavailable for a provisioned rule even with canWrite=true', () => {
    const { result } = renderHook(() =>
      useRuleActionAbilities(
        loaded(buildRule({ 'grafana.com/access/canWrite': 'true', 'grafana.com/provenance': 'api' }))
      )
    );

    expect(result.current.edit.available).toBe(false);
    expect(result.current.pause.available).toBe(false);
    expect(result.current.edit.reason).toContain('provisioned');
  });

  it('does not block duplicate for a provisioned rule when the user can create rules', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    const { result } = renderHook(() => useRuleActionAbilities(loaded(buildRule({ 'grafana.com/provenance': 'api' }))));

    expect(result.current.duplicate).toEqual({ available: true });
  });

  it('makes edit/pause/delete/duplicate unavailable for a plugin-managed rule', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    const { result } = renderHook(() =>
      useRuleActionAbilities(
        loaded(
          buildRule(
            { 'grafana.com/access/canWrite': 'true', 'grafana.com/access/canDelete': 'true' },
            {
              __grafana_origin: 'plugin/my-plugin',
            }
          )
        )
      )
    );

    expect(result.current.edit.available).toBe(false);
    expect(result.current.delete.available).toBe(false);
    expect(result.current.duplicate.available).toBe(false);
  });

  it('ACT-7: names the manager, in place of the provisioned reason, when a rule is both provisioned and managed', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    const { result } = renderHook(() =>
      useRuleActionAbilities(
        loaded(
          buildRule({
            'grafana.com/access/canWrite': 'true',
            'grafana.com/access/canDelete': 'true',
            'grafana.com/provenance': 'api',
            'grafana.app/managedBy': 'terraform',
          })
        )
      )
    );

    expect(result.current.edit).toEqual({ available: false, reason: 'Managed by Terraform' });
    expect(result.current.pause).toEqual({ available: false, reason: 'Managed by Terraform' });
    expect(result.current.delete).toEqual({ available: false, reason: 'Managed by Terraform' });
    expect(result.current.duplicate).toEqual({ available: true });
  });

  it('ACT-7: does not treat the Grafana UI as a manager', () => {
    const { result } = renderHook(() =>
      useRuleActionAbilities(
        loaded(buildRule({ 'grafana.com/access/canWrite': 'true', 'grafana.app/managedBy': 'grafana' }))
      )
    );

    expect(result.current.edit).toEqual({ available: true });
  });

  it('ACT-5: restricts a rule only when its origin label starts with plugin/', () => {
    const annotations = { 'grafana.com/access/canWrite': 'true' };
    const { result: plugin } = renderHook(() =>
      useRuleActionAbilities(loaded(buildRule(annotations, { __grafana_origin: 'plugin/my-plugin' })))
    );
    const { result: other } = renderHook(() =>
      useRuleActionAbilities(loaded(buildRule(annotations, { __grafana_origin: 'my-plugin' })))
    );

    expect(plugin.current.edit.available).toBe(false);
    expect(other.current.edit).toEqual({ available: true });
  });

  it('denies duplicate without the create permission, independent of canWrite/canDelete', () => {
    const { result } = renderHook(() =>
      useRuleActionAbilities(
        loaded(buildRule({ 'grafana.com/access/canWrite': 'true', 'grafana.com/access/canDelete': 'true' }))
      )
    );

    expect(result.current.duplicate.available).toBe(false);
  });
});

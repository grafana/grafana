import { renderHook } from 'test/test-utils';

import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { FAILED_RULE, LOADING_RULE, buildAlertRule, loadedRule } from '../mocks/factories';

import { useRuleActionAbilities } from './useRuleActionAbilities';

const CAN_WRITE = { 'grafana.com/access/canWrite': 'true' };
const CAN_WRITE_AND_DELETE = { ...CAN_WRITE, 'grafana.com/access/canDelete': 'true' };
const NO_PERMISSION = 'You do not have permission to do this';

function abilitiesFor(annotations: Record<string, string>, labels?: Record<string, string>) {
  return renderHook(() => useRuleActionAbilities(loadedRule(buildAlertRule({ annotations, labels })))).result.current;
}

describe('useRuleActionAbilities', () => {
  beforeEach(() => {
    grantUserPermissions([]);
  });

  it('makes every action unavailable while the resource is loading', () => {
    const { result } = renderHook(() => useRuleActionAbilities(LOADING_RULE));

    expect(result.current.edit.available).toBe(false);
    expect(result.current.pause.available).toBe(false);
    expect(result.current.delete.available).toBe(false);
    expect(result.current.duplicate.available).toBe(false);
  });

  it('makes every action unavailable with an unknown permission when the resource failed to load', () => {
    const { result } = renderHook(() => useRuleActionAbilities(FAILED_RULE));

    expect(result.current.edit).toEqual({ available: false, reason: 'Permission unknown' });
    expect(result.current.pause.available).toBe(false);
    expect(result.current.delete.available).toBe(false);
    expect(result.current.duplicate.available).toBe(false);
  });

  it.each<{ name: string; annotations: Record<string, string>; edit: object }>([
    { name: 'canWrite is "true"', annotations: CAN_WRITE, edit: { available: true } },
    {
      name: 'the capability annotations are missing',
      annotations: {},
      edit: { available: false, reason: NO_PERMISSION },
    },
    {
      name: 'canWrite is present but not "true"',
      annotations: { 'grafana.com/access/canWrite': 'false' },
      edit: { available: false, reason: NO_PERMISSION },
    },
  ])('edit follows the canWrite annotation: $name', ({ annotations, edit }) => {
    expect(abilitiesFor(annotations).edit).toEqual(edit);
  });

  it('gates delete on canDelete, independently of canWrite', () => {
    const abilities = abilitiesFor({ ...CAN_WRITE, 'grafana.com/access/canDelete': 'false' });

    expect(abilities.edit).toEqual({ available: true });
    expect(abilities.delete).toEqual({ available: false, reason: NO_PERMISSION });
  });

  it('denies duplicate without the create permission, whatever canWrite and canDelete say', () => {
    expect(abilitiesFor(CAN_WRITE_AND_DELETE).duplicate.available).toBe(false);
  });

  describe('with permission to create rules', () => {
    beforeEach(() => {
      grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    });

    it('lets a plain writable rule be duplicated', () => {
      expect(abilitiesFor(CAN_WRITE_AND_DELETE).duplicate).toEqual({ available: true });
    });

    it.each([
      {
        name: 'provisioned',
        annotations: { ...CAN_WRITE_AND_DELETE, 'grafana.com/provenance': 'api' },
        reason: 'Provisioned',
      },
      {
        name: 'provisioned and managed by Terraform (the manager is named instead)',
        annotations: {
          ...CAN_WRITE_AND_DELETE,
          'grafana.com/provenance': 'api',
          'grafana.app/managedBy': 'terraform',
        },
        reason: 'Managed by Terraform',
      },
      {
        name: 'provisioned by classic file provisioning (no manager is named)',
        annotations: {
          ...CAN_WRITE_AND_DELETE,
          'grafana.com/provenance': 'api',
          'grafana.app/managedBy': 'classic-file-provisioning',
        },
        reason: 'Provisioned',
      },
      {
        name: 'provisioned by classic API provisioning (no manager is named)',
        annotations: {
          ...CAN_WRITE_AND_DELETE,
          'grafana.com/provenance': 'api',
          'grafana.app/managedBy': 'classic-api-provisioning',
        },
        reason: 'Provisioned',
      },
    ])('blocks edit, pause and delete but not duplicate for a rule that is $name', ({ annotations, reason }) => {
      const abilities = abilitiesFor(annotations);

      expect(abilities.edit).toEqual({ available: false, reason });
      expect(abilities.pause).toEqual({ available: false, reason });
      expect(abilities.delete).toEqual({ available: false, reason });
      expect(abilities.duplicate).toEqual({ available: true });
    });

    it('blocks edit, delete and duplicate for a plugin-managed rule', () => {
      const abilities = abilitiesFor(CAN_WRITE_AND_DELETE, { __grafana_origin: 'plugin/my-plugin' });

      expect(abilities.edit.available).toBe(false);
      expect(abilities.delete.available).toBe(false);
      expect(abilities.duplicate.available).toBe(false);
    });

    it.each([
      {
        name: 'an origin label that does not start with plugin/',
        annotations: CAN_WRITE,
        labels: { __grafana_origin: 'my-plugin' },
      },
      {
        name: 'the Grafana UI as manager',
        annotations: { ...CAN_WRITE, 'grafana.app/managedBy': 'grafana' },
        labels: undefined,
      },
    ])('restricts nothing for $name', ({ annotations, labels }) => {
      expect(abilitiesFor(annotations, labels).edit).toEqual({ available: true });
    });
  });
});

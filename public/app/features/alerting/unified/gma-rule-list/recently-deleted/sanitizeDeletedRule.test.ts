import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { sanitizeDeletedRule } from './sanitizeDeletedRule';

function buildTombstone(): AlertRule {
  return {
    apiVersion: 'v0alpha1',
    kind: 'AlertRule',
    metadata: {
      name: 'rule-uid-1',
      resourceVersion: '42',
      deletionTimestamp: '2024-01-01T00:00:00Z',
      deletionGracePeriodSeconds: 0,
      managedFields: [{ manager: 'grafana' }],
      finalizers: ['some-finalizer'],
      annotations: {
        'grafana.app/folder': 'folder-uid',
        'grafana.app/updatedBy': 'user:1',
        'grafana.com/provenance': 'none',
        'grafana.app/managedBy': 'repo',
        'grafana.app/managerId': 'repo-1',
        'grafana.app/managerAllowsEdits': 'true',
        'grafana.com/access/canWrite': 'true',
        'grafana.com/access/canDelete': 'true',
      },
      labels: {
        'grafana.com/group': 'group-1',
        'grafana.com/group-index': '0',
        'grafana.app/some-other-label': 'keep-me',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    spec: {
      title: 'My rule',
      labels: { severity: 'critical' },
      execErrState: 'Alerting',
      noDataState: 'NoData',
      trigger: { interval: '1m' },
      expressions: {},
    },
    status: {
      health: 'Unknown',
      lastError: 'some internal error',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

describe('sanitizeDeletedRule', () => {
  it('removes deletion metadata, resourceVersion, managedFields, and finalizers', () => {
    const sanitized = sanitizeDeletedRule(buildTombstone());

    expect(sanitized.metadata).not.toHaveProperty('deletionTimestamp');
    expect(sanitized.metadata).not.toHaveProperty('deletionGracePeriodSeconds');
    expect(sanitized.metadata).not.toHaveProperty('resourceVersion');
    expect(sanitized.metadata).not.toHaveProperty('managedFields');
    expect(sanitized.metadata).not.toHaveProperty('finalizers');
  });

  it('removes status entirely', () => {
    const sanitized = sanitizeDeletedRule(buildTombstone());

    expect(sanitized).not.toHaveProperty('status');
  });

  it('removes provenance/manager and access annotations while keeping unrelated ones', () => {
    const sanitized = sanitizeDeletedRule(buildTombstone());

    expect(sanitized.metadata.annotations).toEqual({
      'grafana.app/folder': 'folder-uid',
      'grafana.app/updatedBy': 'user:1',
    });
  });

  it('removes grafana.com/group* labels while keeping unrelated ones', () => {
    const sanitized = sanitizeDeletedRule(buildTombstone());

    expect(sanitized.metadata.labels).toEqual({
      'grafana.app/some-other-label': 'keep-me',
    });
  });

  it('keeps the rule spec and name untouched', () => {
    const original = buildTombstone();
    const sanitized = sanitizeDeletedRule(original);

    expect(sanitized.spec).toEqual(original.spec);
    expect(sanitized.metadata.name).toBe('rule-uid-1');
  });
});

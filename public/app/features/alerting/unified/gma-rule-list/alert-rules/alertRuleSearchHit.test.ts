import { alertRuleSearchHitSchema } from './alertRuleSearchHit';

function toHit(fields?: unknown) {
  return alertRuleSearchHitSchema.parse({
    resource: { group: 'rules.alerting.grafana.app', kind: 'AlertRule', resource: 'alertrules', name: 'rule-1' },
    fields,
  });
}

const NO_TOTALS = {
  healthy: undefined,
  firing: undefined,
  pending: undefined,
  recovering: undefined,
  noData: undefined,
  error: undefined,
};

describe('alertRuleSearchHitSchema', () => {
  it('reads the row fields from the search hit', () => {
    const hit = toHit({
      title: 'CPU high',
      folder: 'folder-1',
      paused: true,
      interval: '1m',
      state: 'Firing',
      health: 'OK',
      lastError: 'timeout',
      labels: ['team=infra', 'critical'],
      datasourceUIDs: ['prom-1', 7],
      notificationType: 'SimplifiedRouting',
      receiver: 'ops-email',
      routingTree: 'ops',
    });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'CPU high',
      folderUid: 'folder-1',
      paused: true,
      interval: '1m',
      state: 'Firing',
      health: 'OK',
      lastError: 'timeout',
      totals: NO_TOTALS,
      summary: undefined,
      labels: { team: 'infra', critical: '' },
      dataSourceUids: ['prom-1'],
      notificationType: 'SimplifiedRouting',
      receiver: 'ops-email',
      routingTree: 'ops',
    });
  });

  it('falls back to the rule UID for the title and leaves fields of the wrong type unset', () => {
    const hit = toHit({ title: 42, folder: ['folder-1'], paused: 'true', state: null, labels: 'team=infra' });

    expect(hit).toMatchObject({
      uid: 'rule-1',
      title: 'rule-1',
      folderUid: undefined,
      paused: undefined,
      state: undefined,
      labels: {},
    });
  });

  it.each([
    { name: 'no fields', fields: undefined },
    { name: 'fields that are not an object', fields: 'title=CPU high' },
  ])('falls back to the rule UID alone when the search returned $name', ({ fields }) => {
    expect(toHit(fields)).toEqual({
      uid: 'rule-1',
      title: 'rule-1',
      totals: NO_TOTALS,
      labels: {},
      dataSourceUids: [],
    });
  });

  it('reads every returned instance total, keeping a returned zero', () => {
    const hit = toHit({
      totalsHealthy: 4,
      totalsFiring: 0,
      totalsPending: 2,
      totalsRecovering: 1,
      totalsNoData: 3,
      totalsError: 5,
    });

    expect(hit.totals).toEqual({ healthy: 4, firing: 0, pending: 2, recovering: 1, noData: 3, error: 5 });
  });

  it('leaves a total undefined, never zero, when the search did not return it', () => {
    const hit = toHit({ totalsFiring: 2, totalsPending: 'many' });

    expect(hit.totals).toEqual({ ...NO_TOTALS, firing: 2 });
  });

  it('reads the summary from the JSON-encoded annotations', () => {
    const hit = toHit({
      annotations: JSON.stringify({ summary: 'CPU above 90%', runbook_url: 'https://example.com' }),
    });

    expect(hit.summary).toBe('CPU above 90%');
  });

  it('leaves the summary undefined when the annotations are absent or not valid JSON', () => {
    expect(toHit({}).summary).toBeUndefined();
    expect(toHit({ annotations: '{not json' }).summary).toBeUndefined();
  });

  it.each([
    { name: 'another case', state: 'FIRING', health: 'ok' },
    { name: 'an unknown value', state: 'Mystery', health: 'Degraded' },
    { name: 'the Recording rule health', state: 'Firing', health: 'Recording' },
  ])('leaves state or health unset for $name', ({ state, health }) => {
    const hit = toHit({ state, health });

    expect(hit.health).toBeUndefined();
    expect(hit.state).toBe(state === 'Firing' ? 'Firing' : undefined);
  });
});

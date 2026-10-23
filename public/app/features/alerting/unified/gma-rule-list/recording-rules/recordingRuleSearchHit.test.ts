import { recordingRuleSearchHitSchema } from './recordingRuleSearchHit';

function toHit(fields?: unknown) {
  return recordingRuleSearchHitSchema.parse({
    resource: {
      group: 'rules.alerting.grafana.app',
      kind: 'RecordingRule',
      resource: 'recordingrules',
      name: 'rule-1',
    },
    fields,
  });
}

describe('recordingRuleSearchHitSchema', () => {
  it('reads the row fields from the search hit', () => {
    const hit = toHit({
      title: 'cpu:usage:rate5m',
      folder: 'folder-1',
      paused: true,
      interval: '1m',
      metric: 'cpu:usage:rate5m',
      targetDatasourceUID: 'prom-target',
      health: 'Recording',
      lastError: 'timeout',
      labels: ['team=infra'],
      datasourceUIDs: ['prom-1', 7],
    });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'cpu:usage:rate5m',
      folderUid: 'folder-1',
      paused: true,
      interval: '1m',
      metric: 'cpu:usage:rate5m',
      targetDataSourceUid: 'prom-target',
      health: 'Recording',
      lastError: 'timeout',
      labels: { team: 'infra' },
      dataSourceUids: ['prom-1'],
    });
  });

  it('falls back to the rule UID for the title and leaves fields of the wrong type unset', () => {
    const hit = toHit({ title: 42, folder: ['folder-1'], paused: 'true', metric: 3 });

    expect(hit).toMatchObject({
      uid: 'rule-1',
      title: 'rule-1',
      folderUid: undefined,
      paused: undefined,
      metric: undefined,
      health: undefined,
    });
  });

  it.each([
    { name: 'no fields', fields: undefined },
    { name: 'fields that are not an object', fields: 'title=cpu:usage:rate5m' },
  ])('falls back to the rule UID alone when the search returned $name', ({ fields }) => {
    expect(toHit(fields)).toEqual({ uid: 'rule-1', title: 'rule-1', labels: {}, dataSourceUids: [] });
  });

  it('reads health Error as Error', () => {
    expect(toHit({ health: 'Error' }).health).toBe('Error');
  });

  it.each([
    { name: 'wrong case', health: 'recording' },
    { name: 'an unknown value', health: 'Degraded' },
    { name: 'an Alert rule health value', health: 'OK' },
  ])('leaves health unset for $name', ({ health }) => {
    expect(toHit({ health }).health).toBeUndefined();
  });
});

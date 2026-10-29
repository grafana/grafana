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
    const hit = toHit({ title: 'cpu:usage:rate5m', folder: 'folder-1', paused: true, health: 'Recording' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'cpu:usage:rate5m',
      folderUid: 'folder-1',
      paused: true,
      health: 'Recording',
    });
  });

  it('falls back to the rule UID for the title and leaves fields of the wrong type unset', () => {
    const hit = toHit({ title: 42, folder: ['folder-1'], paused: 'true' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'rule-1',
      folderUid: undefined,
      paused: undefined,
      health: undefined,
    });
  });

  it.each([
    { name: 'no fields', fields: undefined },
    { name: 'fields that are not an object', fields: 'title=cpu:usage:rate5m' },
  ])('falls back to the rule UID alone when the search returned $name', ({ fields }) => {
    expect(toHit(fields)).toEqual({ uid: 'rule-1', title: 'rule-1' });
  });

  it.each([
    { name: 'wrong case', health: 'recording' },
    { name: 'an unknown value', health: 'Degraded' },
    { name: 'an Alert rule health value', health: 'OK' },
  ])('leaves health unset for $name', ({ health }) => {
    expect(toHit({ health }).health).toBeUndefined();
  });

  it('reads lastError from the search hit', () => {
    const hit = toHit({ lastError: 'remote write failed' });

    expect(hit.lastError).toBe('remote write failed');
  });

  it('leaves lastError unset when absent or not a string', () => {
    expect(toHit({}).lastError).toBeUndefined();
    expect(toHit({ lastError: 42 }).lastError).toBeUndefined();
  });

  it('does not expose a summary field even when annotations are present', () => {
    const annotations = JSON.stringify({ summary: 'some summary' });
    const hit = toHit({ annotations });

    expect(hit).not.toHaveProperty('summary');
  });

  it('reads interval from the search hit', () => {
    const hit = toHit({ interval: '1m' });

    expect(hit.interval).toBe('1m');
  });

  it('leaves interval unset when absent or not a string', () => {
    expect(toHit({}).interval).toBeUndefined();
    expect(toHit({ interval: 60 }).interval).toBeUndefined();
  });

  it('parses labels using the same rules as alert rules — key=value only, private keys excluded', () => {
    const hit = toHit({ labels: ['team=platform', '__grafana_origin=plugin', 'env'] });
    expect(hit.labels).toEqual({ team: 'platform' });
  });

  it('leaves labels unset when absent or empty', () => {
    expect(toHit({}).labels).toBeUndefined();
    expect(toHit({ labels: [] }).labels).toBeUndefined();
  });

  it('stores datasourceUIDs as-is', () => {
    const hit = toHit({ datasourceUIDs: ['ds-1'] });
    expect(hit.datasourceUIDs).toEqual(['ds-1']);
  });

  it('reads metric from the search hit', () => {
    expect(toHit({ metric: 'cpu:usage:rate5m' }).metric).toBe('cpu:usage:rate5m');
  });

  it('reads targetDatasourceUID from the search hit', () => {
    expect(toHit({ targetDatasourceUID: 'ds-prom' }).targetDatasourceUID).toBe('ds-prom');
  });

  it('leaves metric and targetDatasourceUID unset when absent', () => {
    expect(toHit({}).metric).toBeUndefined();
    expect(toHit({}).targetDatasourceUID).toBeUndefined();
  });

  it('keeps the plugin origin label that the displayed labels leave out', () => {
    expect(toHit({ labels: ['__grafana_origin=plugin/counted-app'] }).originLabel).toBe('plugin/counted-app');
  });
});

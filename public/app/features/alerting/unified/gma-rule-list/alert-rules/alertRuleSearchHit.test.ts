import { alertRuleSearchHitSchema } from './alertRuleSearchHit';

function toHit(fields?: unknown) {
  return alertRuleSearchHitSchema.parse({
    resource: { group: 'rules.alerting.grafana.app', kind: 'AlertRule', resource: 'alertrules', name: 'rule-1' },
    fields,
  });
}

describe('alertRuleSearchHitSchema', () => {
  it('reads the row fields from the search hit', () => {
    const hit = toHit({ title: 'CPU high', folder: 'folder-1', paused: true, state: 'Firing', health: 'OK' });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'CPU high',
      folderUid: 'folder-1',
      paused: true,
      state: 'Firing',
      health: 'OK',
    });
  });

  it('falls back to the rule UID for the title and leaves fields of the wrong type unset', () => {
    const hit = toHit({ title: 42, folder: ['folder-1'], paused: 'true', state: null });

    expect(hit).toEqual({
      uid: 'rule-1',
      title: 'rule-1',
      folderUid: undefined,
      paused: undefined,
      state: undefined,
      health: undefined,
    });
  });

  it.each([
    { name: 'no fields', fields: undefined },
    { name: 'fields that are not an object', fields: 'title=CPU high' },
  ])('falls back to the rule UID alone when the search returned $name', ({ fields }) => {
    expect(toHit(fields)).toEqual({ uid: 'rule-1', title: 'rule-1' });
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

  it('reads lastError from the search hit', () => {
    const hit = toHit({ lastError: 'remote write failed' });

    expect(hit.lastError).toBe('remote write failed');
  });

  it('leaves lastError unset when absent or not a string', () => {
    expect(toHit({}).lastError).toBeUndefined();
    expect(toHit({ lastError: 42 }).lastError).toBeUndefined();
  });

  it('reads the summary annotation from the JSON-encoded annotations field', () => {
    const annotations = JSON.stringify({ summary: 'CPU is high', runbook_url: 'https://example.com' });
    const hit = toHit({ annotations });

    expect(hit.summary).toBe('CPU is high');
  });

  it('leaves summary unset when annotations has no summary key', () => {
    const hit = toHit({ annotations: JSON.stringify({ runbook_url: 'https://example.com' }) });

    expect(hit.summary).toBeUndefined();
  });

  it('leaves summary unset when annotations is malformed JSON', () => {
    expect(toHit({ annotations: 'not-json' }).summary).toBeUndefined();
    expect(toHit({ annotations: 42 }).summary).toBeUndefined();
  });

  it('reads interval from the search hit', () => {
    const hit = toHit({ interval: '5m' });

    expect(hit.interval).toBe('5m');
  });

  it('leaves interval unset when absent or not a string', () => {
    expect(toHit({}).interval).toBeUndefined();
    expect(toHit({ interval: 60 }).interval).toBeUndefined();
  });

  it('parses key=value label entries into a Labels object, filtering private keys', () => {
    const hit = toHit({
      labels: ['team=platform', 'env=prod', '__grafana_origin=plugin-xyz', '__private__=hidden', 'env'],
    });

    expect(hit.labels).toEqual({ team: 'platform', env: 'prod' });
  });

  it('leaves labels unset when the array is empty or has no key=value entries', () => {
    expect(toHit({ labels: [] }).labels).toBeUndefined();
    expect(toHit({ labels: ['team', 'env'] }).labels).toBeUndefined();
    expect(toHit({}).labels).toBeUndefined();
  });

  it('leaves labels unset when the field is not an array', () => {
    expect(toHit({ labels: 'team=platform' }).labels).toBeUndefined();
  });

  it('stores datasourceUIDs as-is', () => {
    const hit = toHit({ datasourceUIDs: ['ds-1', 'ds-2'] });
    expect(hit.datasourceUIDs).toEqual(['ds-1', 'ds-2']);
  });

  it('leaves datasourceUIDs unset when absent or not an array', () => {
    expect(toHit({}).datasourceUIDs).toBeUndefined();
    expect(toHit({ datasourceUIDs: 'ds-1' }).datasourceUIDs).toBeUndefined();
  });
});
